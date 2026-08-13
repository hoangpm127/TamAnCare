import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

type LegacyRecord = {
  sourceRow: number;
  sourceRows?: number[];
  fullName: string;
  phone: string;
  memberStatus: string;
  source: string;
  assignedTherapist: string;
  legacyPrice: string;
  paymentStatus: string;
  paymentMethod: string;
  service: string;
  totalSessions: number;
  usedSessions: number;
};

type ImportPayload = {
  sourceFile: string;
  records: LegacyRecord[];
  rejected: Array<{ sourceRow: number; reason: string }>;
};

const IMPORT_ACTION = "LEGACY_CUSTOMER_IMPORT_20260813";
const inputPath = process.env.LEGACY_CUSTOMER_IMPORT_JSON;
const importPin = process.env.LEGACY_CUSTOMER_IMPORT_PIN;
const apply = process.argv.includes("--apply");

function normalizeVietnamPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("84")) return `0${digits.slice(2)}`;
  return digits;
}

function isVietnamMobilePhone(value: string) {
  return /^0(?:3|5|7|8|9)\d{8}$/.test(normalizeVietnamPhone(value));
}

async function main() {
  if (!inputPath) throw new Error("Thiếu LEGACY_CUSTOMER_IMPORT_JSON.");
  if (!importPin || !/^\d{4}$/.test(importPin)) {
    throw new Error("Thiếu LEGACY_CUSTOMER_IMPORT_PIN gồm đúng 4 số.");
  }
  const payload = JSON.parse(
    await fs.readFile(inputPath, "utf8"),
  ) as ImportPayload;
  if (!Array.isArray(payload.records) || payload.records.length === 0)
    throw new Error("File nhập không có khách hợp lệ.");

  const records = payload.records.map((record) => ({
    ...record,
    fullName: record.fullName.replace(/\s+/g, " ").trim(),
    phone: normalizeVietnamPhone(record.phone),
    totalSessions: Math.max(0, Math.trunc(record.totalSessions || 0)),
    usedSessions: Math.max(0, Math.trunc(record.usedSessions || 0)),
  }));
  if (
    records.some(
      (record) =>
        record.fullName.length < 2 || !isVietnamMobilePhone(record.phone),
    )
  ) {
    throw new Error("Dữ liệu nhập còn tên hoặc số điện thoại không hợp lệ.");
  }
  if (new Set(records.map((record) => record.phone)).size !== records.length) {
    throw new Error("Dữ liệu nhập còn trùng số điện thoại.");
  }

  const phones = records.map((record) => record.phone);
  const [existingCustomers, existingAccounts, owner] = await Promise.all([
    db.customer.findMany({
      where: { phone: { in: phones } },
      select: {
        id: true,
        phone: true,
        fullName: true,
        totalVisits: true,
        segment: true,
        internalNote: true,
        account: { select: { id: true, phone: true, pinHash: true } },
      },
    }),
    db.customerAccount.findMany({
      where: { phone: { in: phones } },
      select: { id: true, phone: true, customerId: true, pinHash: true },
    }),
    db.user.findFirst({
      where: { role: "OWNER", isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
  ]);
  if (!owner)
    throw new Error(
      "Không tìm thấy tài khoản OWNER để ghi nhật ký nhập dữ liệu.",
    );

  const customerByPhone = new Map(
    existingCustomers.map((customer) => [customer.phone, customer]),
  );
  const accountByPhone = new Map(
    existingAccounts.map((account) => [account.phone, account]),
  );
  for (const record of records) {
    const customer = customerByPhone.get(record.phone);
    const account = accountByPhone.get(record.phone);
    if (account && customer && account.customerId !== customer.id) {
      throw new Error(
        "Phát hiện xung đột liên kết tài khoản; đã dừng trước khi ghi dữ liệu.",
      );
    }
  }

  const sourceFingerprint = createHash("sha256")
    .update(JSON.stringify(records))
    .digest("hex");
  const dryRunSummary = {
    mode: apply ? "APPLY" : "DRY_RUN",
    inputRows: records.length,
    rejectedRows: payload.rejected?.length ?? 0,
    customersToCreate: records.length - existingCustomers.length,
    customersToUpdate: existingCustomers.length,
    accountsToCreate: records.length - existingAccounts.length,
    existingAccountPinsToReset: existingAccounts.length,
  };

  if (!apply) {
    console.log(JSON.stringify(dryRunSummary, null, 2));
    await db.$disconnect();
    process.exit(0);
  }

  function affiliateBaseCode(fullName: string, phone: string) {
    const name =
      fullName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 12) || "TAMAN";
    return `${name}${phone.slice(-4)}`;
  }

  function legacyNote(record: LegacyRecord) {
    const marker = `[${IMPORT_ACTION}_ROW_${record.sourceRow}]`;
    const details = [
      record.memberStatus && `Tình trạng: ${record.memberStatus}`,
      record.source && `Nguồn: ${record.source}`,
      record.assignedTherapist && `KTV cũ: ${record.assignedTherapist}`,
      record.service && `Gói cũ: ${record.service}`,
      record.totalSessions > 0 && `${record.totalSessions} buổi`,
      record.usedSessions > 0 && `đã làm ${record.usedSessions}`,
      record.legacyPrice && `giá ghi nhận: ${record.legacyPrice}`,
      (record.paymentStatus || record.paymentMethod) &&
        `thanh toán: ${[record.paymentStatus, record.paymentMethod].filter(Boolean).join("/")}`,
    ]
      .filter(Boolean)
      .join(" · ");
    return `${marker} Khách cũ nhập từ file cơ sở${details ? ` · ${details}` : ""}. Quyền lợi gói cũ chưa được tự động cộng; lễ tân đối chiếu trước khi sử dụng.`;
  }

  const result = await db.$transaction(
    async (tx) => {
      let customersCreated = 0;
      let customersUpdated = 0;
      let accountsCreated = 0;
      let accountPinsInitialized = 0;
      let campaignsCreated = 0;

      for (const record of records) {
        const importedNote = legacyNote(record);
        const current = await tx.customer.findUnique({
          where: { phone: record.phone },
          include: { account: true },
        });
        const importedVisits = Math.max(1, record.usedSessions);
        const customer = current
          ? await tx.customer.update({
              where: { id: current.id },
              data: {
                totalVisits: Math.max(current.totalVisits, importedVisits),
                segment:
                  current.segment === "NEW" ? "RETURNING" : current.segment,
                firstSource:
                  current.firstSource ??
                  (record.source
                    ? `LEGACY_IMPORT:${record.source}`
                    : "LEGACY_IMPORT"),
                internalNote: current.internalNote?.includes(
                  `[${IMPORT_ACTION}_ROW_`,
                )
                  ? current.internalNote
                  : [current.internalNote, importedNote]
                      .filter(Boolean)
                      .join("\n"),
              },
            })
          : await tx.customer.create({
              data: {
                fullName: record.fullName,
                phone: record.phone,
                firstSource: record.source
                  ? `LEGACY_IMPORT:${record.source}`
                  : "LEGACY_IMPORT",
                commonIssues: [],
                internalNote: importedNote,
                totalVisits: importedVisits,
                totalSpend: 0,
                segment: "RETURNING",
              },
            });
        if (current) customersUpdated += 1;
        else customersCreated += 1;

        const existingAccount =
          current?.account ??
          (await tx.customerAccount.findUnique({
            where: { phone: record.phone },
          }));
        if (!existingAccount) {
          await tx.customerAccount.create({
            data: {
              customerId: customer.id,
              phone: record.phone,
              passwordHash: null,
            pinHash: hashPassword(importPin),
              phoneVerifiedAt: null,
              creditBalance: 0,
              welcomeCreditGrantedAt: null,
              freeConsultationEligible: false,
            },
          });
          accountsCreated += 1;
        } else {
          await tx.customerAccount.update({
            where: { id: existingAccount.id },
            data: {
            pinHash: hashPassword(importPin),
              creditBalance: 0,
              welcomeCreditGrantedAt: null,
              freeConsultationEligible: false,
            },
          });
          accountPinsInitialized += 1;
        }

        const affiliateSource = `AFFILIATE:${customer.id}`;
        const existingCampaign = await tx.campaign.findFirst({
          where: { source: affiliateSource },
          select: { id: true },
        });
        if (!existingCampaign) {
          const baseCode = affiliateBaseCode(customer.fullName, customer.phone);
          const baseConflict = await tx.campaign.findUnique({
            where: { code: baseCode },
            select: { id: true },
          });
          const code = baseConflict
            ? `${baseCode}${customer.id.slice(-4).toUpperCase()}`
            : baseCode;
          await tx.campaign.create({
            data: {
              code,
              name: `Affiliate · ${customer.fullName}`,
              source: affiliateSource,
              manualCost: 0,
            },
          });
          campaignsCreated += 1;
        }
      }

      const existingAudit = await tx.adminAuditLog.findFirst({
        where: {
          action: IMPORT_ACTION,
          entityType: "CustomerAccountBatch",
          entityId: sourceFingerprint,
        },
        select: { id: true },
      });
      if (!existingAudit) {
        await tx.adminAuditLog.create({
          data: {
            actorUserId: owner.id,
            action: IMPORT_ACTION,
            entityType: "CustomerAccountBatch",
            entityId: sourceFingerprint,
            after: {
              sourceFile: payload.sourceFile,
              inputRows: records.length,
              rejectedRows: payload.rejected?.length ?? 0,
              customersCreated,
              customersUpdated,
              accountsCreated,
              accountPinsInitialized,
              campaignsCreated,
              welcomeCreditGranted: false,
              legacyPackagesActivated: false,
            },
          },
        });
      }

      return {
        customersCreated,
        customersUpdated,
        accountsCreated,
        accountPinsInitialized,
        campaignsCreated,
      };
    },
    { maxWait: 10_000, timeout: 120_000 },
  );

  const verifiedAccounts = await db.customerAccount.findMany({
    where: { phone: { in: phones } },
    select: {
      phone: true,
      pinHash: true,
      creditBalance: true,
      welcomeCreditGrantedAt: true,
    },
  });
  const pinReady = verifiedAccounts.filter(
    (account) =>
      account.pinHash && verifyPassword(importPin, account.pinHash),
  ).length;
  const campaignsReady = await db.campaign.count({
    where: {
      source: {
        in: (
          await db.customer.findMany({
            where: { phone: { in: phones } },
            select: { id: true },
          })
        ).map((customer) => `AFFILIATE:${customer.id}`),
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        ...dryRunSummary,
        ...result,
        verifiedAccounts: verifiedAccounts.length,
    accountsWithImportPinVerified: pinReady,
        affiliateCampaignsReady: campaignsReady,
        importedAccountsWithWelcomeCredit: verifiedAccounts.filter(
          (account) =>
            account.creditBalance > 0 || account.welcomeCreditGrantedAt,
        ).length,
      },
      null,
      2,
    ),
  );

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exitCode = 1;
});
