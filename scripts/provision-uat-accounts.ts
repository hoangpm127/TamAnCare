import "dotenv/config";

import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { hashPassword } from "../lib/password";

const CONFIRMATION = "PROVISION_TUE_TAM_UAT";
const UAT_USERNAMES = [
  "uat.owner",
  "uat.manager.cs1",
  "uat.manager.cs2",
  "uat.reception.cs1",
  "uat.ktv.cs1",
  "uat.ktv.cs2",
  "uat.investor",
] as const;

type Credential = {
  role: string;
  login: string;
  password: string;
  scope: string;
  firstAction: string;
};

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function temporaryPassword() {
  const random = randomBytes(15).toString("base64url");
  return `Tt!${random}9a`;
}

function requiredPhone(name: "UAT_NEW_CUSTOMER_PHONE" | "UAT_AFFILIATE_CUSTOMER_PHONE") {
  const phone = process.env[name]?.replace(/\s+/g, "");
  if (!phone || !/^[0-9+]{8,15}$/.test(phone)) {
    throw new Error(`${name} phải là số điện thoại kiểm thử do bạn hoặc nhân viên kiểm soát.`);
  }
  return phone;
}

function credentialPath() {
  const requested = argument("output");
  if (requested) return resolve(requested);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return resolve("artifacts", `uat-credentials-${stamp}.json`);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL chưa được cấu hình.");

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });
const cleanup = process.argv.includes("--cleanup");
const dryRun = process.argv.includes("--dry-run");

async function deactivateUatAccounts() {
  const users = await prisma.user.findMany({
    where: { username: { in: [...UAT_USERNAMES] } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  const phones = [process.env.UAT_NEW_CUSTOMER_PHONE, process.env.UAT_AFFILIATE_CUSTOMER_PHONE]
    .map((phone) => phone?.replace(/\s+/g, ""))
    .filter((phone): phone is string => Boolean(phone));
  const customers = phones.length
    ? await prisma.customer.findMany({ where: { phone: { in: phones } }, select: { id: true } })
    : [];
  const customerIds = customers.map((customer) => customer.id);

  if (dryRun) {
    console.log(JSON.stringify({ action: "cleanup", users: userIds.length, customers: customerIds.length, dryRun: true }, null, 2));
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (userIds.length) {
      await tx.adminSession.deleteMany({ where: { userId: { in: userIds } } });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: { in: userIds } } });
      await tx.user.updateMany({
        where: { id: { in: userIds } },
        data: {
          isActive: false,
          passwordHash: hashPassword(temporaryPassword()),
          failedLoginCount: 0,
          lockedUntil: null,
          totpSecretEncrypted: null,
          mfaSetupExpiresAt: null,
          mfaEnabledAt: null,
          lastTotpCounter: null,
        },
      });
    }
    if (customerIds.length) {
      await tx.customerSession.deleteMany({ where: { customerId: { in: customerIds } } });
      await tx.passwordResetChallenge.deleteMany({ where: { customerId: { in: customerIds } } });
      for (const customerId of customerIds) {
        await tx.customerAccount.updateMany({
          where: { customerId },
          data: { passwordHash: hashPassword(temporaryPassword()) },
        });
      }
    }
  });
  console.log(`Đã vô hiệu hóa ${userIds.length} tài khoản nội bộ UAT và thu hồi ${customerIds.length} phiên khách kiểm thử.`);
}

async function upsertInternalUser(input: {
  username: (typeof UAT_USERNAMES)[number];
  name: string;
  role: "OWNER" | "MANAGER" | "RECEPTIONIST" | "THERAPIST" | "INVESTOR";
  branchId?: string;
  password: string;
}) {
  const email = `${input.username}@uat.tamancare.invalid`;
  return prisma.user.upsert({
    where: { username: input.username },
    create: {
      name: input.name,
      username: input.username,
      email,
      passwordHash: hashPassword(input.password),
      passwordChangedAt: null,
      role: input.role,
      branchId: input.branchId,
      isActive: true,
    },
    update: {
      name: input.name,
      email,
      passwordHash: hashPassword(input.password),
      passwordChangedAt: null,
      role: input.role,
      branchId: input.branchId,
      isActive: true,
      failedLoginCount: 0,
      lockedUntil: null,
      totpSecretEncrypted: null,
      mfaSetupExpiresAt: null,
      mfaEnabledAt: null,
      lastTotpCounter: null,
    },
  });
}

async function provision() {
  if (process.env.APP_ENV !== "uat" && !dryRun) {
    throw new Error('APP_ENV phải bằng "uat". Công cụ này không được chạy trên production hoặc local dùng chung.');
  }
  if (process.env.UAT_PROVISION_CONFIRMATION !== CONFIRMATION && !dryRun) {
    throw new Error(`Đặt UAT_PROVISION_CONFIRMATION=${CONFIRMATION} để xác nhận đúng CSDL UAT.`);
  }

  const branches = await prisma.branch.findMany({ orderBy: { createdAt: "asc" }, take: 2 });
  if (branches.length < 2) throw new Error("CSDL cần có ít nhất hai cơ sở trước khi tạo tài khoản UAT.");
  const [branch1, branch2] = branches;
  const therapists = await Promise.all([
    prisma.therapist.findFirst({ where: { branchId: branch1.id, status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    prisma.therapist.findFirst({ where: { branchId: branch2.id, status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
  ]);
  if (!therapists[0] || !therapists[1]) throw new Error("Mỗi cơ sở cần ít nhất một KTV đang hoạt động.");

  if (dryRun) {
    console.log(JSON.stringify({
      action: "provision",
      dryRun: true,
      branches: branches.map((branch) => ({ id: branch.id, name: branch.name })),
      accounts: [...UAT_USERNAMES, "UAT_NEW_CUSTOMER_PHONE", "UAT_AFFILIATE_CUSTOMER_PHONE"],
    }, null, 2));
    return;
  }

  const newCustomerPhone = requiredPhone("UAT_NEW_CUSTOMER_PHONE");
  const affiliatePhone = requiredPhone("UAT_AFFILIATE_CUSTOMER_PHONE");
  if (newCustomerPhone === affiliatePhone) throw new Error("Hai số điện thoại UAT phải khác nhau.");

  const credentials: Credential[] = [];
  const internal = [
    { username: "uat.owner", name: "Chủ Tâm An · UAT", role: "OWNER", scope: "Toàn hệ thống", branchId: undefined },
    { username: "uat.manager.cs1", name: "Quản lý Cơ sở 1 · UAT", role: "MANAGER", scope: branch1.name, branchId: branch1.id },
    { username: "uat.manager.cs2", name: "Quản lý Cơ sở 2 · UAT", role: "MANAGER", scope: branch2.name, branchId: branch2.id },
    { username: "uat.reception.cs1", name: "Lễ tân Cơ sở 1 · UAT", role: "RECEPTIONIST", scope: branch1.name, branchId: branch1.id },
    { username: "uat.ktv.cs1", name: therapists[0].fullName, role: "THERAPIST", scope: branch1.name, branchId: branch1.id },
    { username: "uat.ktv.cs2", name: therapists[1].fullName, role: "THERAPIST", scope: branch2.name, branchId: branch2.id },
    { username: "uat.investor", name: "Nhà đầu tư · UAT", role: "INVESTOR", scope: "Danh mục đầu tư UAT", branchId: undefined },
  ] as const;

  const createdUsers = new Map<string, Awaited<ReturnType<typeof upsertInternalUser>>>();
  for (const item of internal) {
    const password = temporaryPassword();
    const user = await upsertInternalUser({ ...item, password });
    createdUsers.set(item.username, user);
    credentials.push({
      role: item.role,
      login: item.username,
      password,
      scope: item.scope,
      firstAction: item.role === "OWNER" || item.role === "MANAGER"
        ? "Đổi mật khẩu, sau đó thiết lập Authenticator và lưu mã khôi phục ngoại tuyến."
        : "Đổi mật khẩu tạm thời ở lần đăng nhập đầu tiên.",
    });
  }

  const investor = createdUsers.get("uat.investor");
  if (!investor) throw new Error("Không tạo được tài khoản Nhà đầu tư UAT.");
  const profile = await prisma.investorProfile.upsert({
    where: { userId: investor.id },
    create: {
      userId: investor.id,
      investedAmount: 1_500_000_000,
      ownershipPercent: 25,
      profitSharePercent: 25,
      targetAnnualReturn: 22,
      startDate: new Date("2026-01-01T00:00:00+07:00"),
      note: "Hồ sơ kiểm thử UAT — không phải số liệu đầu tư thật.",
    },
    update: {
      investedAmount: 1_500_000_000,
      ownershipPercent: 25,
      profitSharePercent: 25,
      targetAnnualReturn: 22,
      note: "Hồ sơ kiểm thử UAT — không phải số liệu đầu tư thật.",
    },
  });
  for (const [index, branch] of branches.entries()) {
    await prisma.investorAllocation.upsert({
      where: { investorProfileId_branchId: { investorProfileId: profile.id, branchId: branch.id } },
      create: {
        investorProfileId: profile.id,
        branchId: branch.id,
        allocatedCapital: index === 0 ? 700_000_000 : 800_000_000,
        ownershipPercent: 25,
      },
      update: {
        allocatedCapital: index === 0 ? 700_000_000 : 800_000_000,
        ownershipPercent: 25,
      },
    });
  }

  const customerDefinitions = [
    { phone: newCustomerPhone, name: "Khách mới · UAT", totalVisits: 0, totalSpend: 0, segment: "NEW", creditBalance: 100_000, source: "UAT_NEW" },
    { phone: affiliatePhone, name: "Khách Affiliate · UAT", totalVisits: 12, totalSpend: 4_800_000, segment: "AFFILIATE", creditBalance: 0, source: "UAT_AFFILIATE" },
  ] as const;
  for (const item of customerDefinitions) {
    const password = temporaryPassword();
    const customer = await prisma.customer.upsert({
      where: { phone: item.phone },
      create: {
        fullName: item.name,
        phone: item.phone,
        firstSource: item.source,
        totalVisits: item.totalVisits,
        totalSpend: item.totalSpend,
        segment: item.segment,
        commonIssues: [],
      },
      update: {
        fullName: item.name,
        firstSource: item.source,
        totalVisits: item.totalVisits,
        totalSpend: item.totalSpend,
        segment: item.segment,
      },
    });
    await prisma.customerAccount.upsert({
      where: { customerId: customer.id },
      create: {
        customerId: customer.id,
        phone: item.phone,
        passwordHash: hashPassword(password),
        phoneVerifiedAt: new Date(),
        creditBalance: item.creditBalance,
        welcomeCreditGrantedAt: item.creditBalance > 0 ? new Date() : null,
      },
      update: {
        phone: item.phone,
        passwordHash: hashPassword(password),
        phoneVerifiedAt: new Date(),
        creditBalance: item.creditBalance,
        welcomeCreditGrantedAt: item.creditBalance > 0 ? new Date() : null,
      },
    });
    const referralCode = `UAT${item.source === "UAT_NEW" ? "NEW" : "AFF"}${item.phone.replace(/\D/g, "").slice(-4)}`;
    await prisma.campaign.upsert({
      where: { code: referralCode },
      create: { code: referralCode, name: `Affiliate · ${item.name}`, source: `AFFILIATE:${customer.id}`, manualCost: 50_000 },
      update: { name: `Affiliate · ${item.name}`, source: `AFFILIATE:${customer.id}`, manualCost: 50_000 },
    });
    credentials.push({
      role: item.source === "UAT_NEW" ? "CUSTOMER_NEW" : "CUSTOMER_AFFILIATE",
      login: item.phone,
      password,
      scope: item.source === "UAT_NEW" ? "Khách chưa có lượt sử dụng, còn quyền lợi 100K" : "Khách quay lại có mã Affiliate",
      firstAction: "Đăng nhập bằng số điện thoại và mật khẩu; không dùng số này ngoài UAT.",
    });
  }

  await prisma.adminSession.deleteMany({ where: { userId: { in: [...createdUsers.values()].map((user) => user.id) } } });
  const output = credentialPath();
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({
    generatedAt: new Date().toISOString(),
    environment: "uat",
    warning: "Tài liệu chứa mật khẩu một lần. Bàn giao qua kênh riêng, sau đó xóa tệp và vô hiệu hóa tài khoản khi kết thúc UAT.",
    loginUrls: { customer: "/tai-khoan", internal: "/dang-nhap-quan-tri" },
    credentials,
  }, null, 2), { encoding: "utf8", mode: 0o600 });
  console.log(`Đã tạo ${credentials.length} tài khoản UAT. Thông tin một lần được lưu tại: ${output}`);
}

async function main() {
  if (cleanup) await deactivateUatAccounts();
  else await provision();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
