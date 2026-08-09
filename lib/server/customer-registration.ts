import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { legalDocumentEvidence } from "@/lib/server/legal-documents";
import { notifyCustomer, notifyOperations } from "@/lib/server/notification-service";

type RegistrationInput = {
  fullName: string;
  phone: string;
  passwordHash: string | null;
  pinHash?: string | null;
  phoneVerifiedAt: Date | null;
  email?: string | null;
  marketingOptIn: boolean;
  consentAt: Date;
  subjectHash: string;
  ipHash: string;
  userAgentHash?: string;
  firstSource: "CUSTOMER_SIGNUP" | "CUSTOMER_SOCIAL_SIGNUP";
};

function affiliateCode(fullName: string, phone: string) {
  const name = fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 12) || "TAMAN";
  return `${name}${phone.replace(/\D/g, "").slice(-4)}`;
}

export async function createCustomerMembership(tx: Prisma.TransactionClient, input: RegistrationInput) {
  const customer = await tx.customer.upsert({
    where: { phone: input.phone },
    create: {
      fullName: input.fullName,
      phone: input.phone,
      email: input.email ?? undefined,
      firstSource: input.firstSource,
      commonIssues: [],
    },
    update: {
      fullName: input.fullName,
      ...(input.email ? { email: input.email } : {}),
    },
  });
  const account = await tx.customerAccount.create({
    data: {
      customerId: customer.id,
      phone: input.phone,
      passwordHash: input.passwordHash,
      pinHash: input.pinHash ?? null,
      phoneVerifiedAt: input.phoneVerifiedAt,
      creditBalance: 150000,
      freeConsultationEligible: true,
    },
    include: { customer: { include: { oauthIdentities: true } } },
  });

  const requiredConsent = [legalDocumentEvidence("TERMS"), legalDocumentEvidence("PRIVACY")];
  const marketingConsent = legalDocumentEvidence("MARKETING");
  await tx.consentRecord.createMany({
    data: [
      ...requiredConsent.map((document) => ({
        customerId: customer.id,
        ...document,
        source: "CUSTOMER_REGISTRATION" as const,
        granted: true,
        subjectHash: input.subjectHash,
        ipHash: input.ipHash,
        userAgentHash: input.userAgentHash,
        grantedAt: input.consentAt,
      })),
      {
        customerId: customer.id,
        ...marketingConsent,
        source: "CUSTOMER_REGISTRATION" as const,
        granted: input.marketingOptIn,
        subjectHash: input.subjectHash,
        ipHash: input.ipHash,
        userAgentHash: input.userAgentHash,
        grantedAt: input.marketingOptIn ? input.consentAt : null,
      },
    ],
  });

  const baseCode = affiliateCode(customer.fullName, customer.phone);
  const existingCampaign = await tx.campaign.findUnique({ where: { code: baseCode } });
  const code = existingCampaign ? `${baseCode}${customer.id.slice(-4).toUpperCase()}` : baseCode;
  await tx.campaign.create({
    data: {
      code,
      name: `Affiliate · ${customer.fullName}`,
      source: `AFFILIATE:${customer.id}`,
      manualCost: 0,
    },
  });
  await notifyCustomer(tx, customer.id, {
    type: "PROMOTION",
    title: "Bạn đã nhận ưu đãi 150K",
    body: "WELCOME150 sẽ tự động được ưu tiên khi bạn đặt dịch vụ lần đầu.",
    actionUrl: "/booking",
  });
  await notifyOperations(tx, {
    type: "INVITATION",
    title: `Thành viên mới · ${customer.fullName}`,
    body: `${customer.phone} vừa tạo tài khoản và nhận ưu đãi thành viên mới 150K.`,
    actionUrl: "/admin/customers",
  });

  return account;
}
