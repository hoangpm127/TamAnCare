import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/server/customer-session";
import { legalDocumentEvidence } from "@/lib/server/legal-documents";
import {
  consumeRateLimit,
  isSameOriginMutation,
  privateIdentifierDigest,
  requestIp,
} from "@/lib/server/request-security";

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200).or(z.literal("")),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  preferredPressure: z.enum(["NHẸ", "VỪA", "MẠNH"]),
  healthNotes: z.string().trim().max(1_500),
  bookingReminders: z.boolean(),
  promotionUpdates: z.boolean(),
});

async function profileFor(customerId: string) {
  const [account, latestMarketing] = await Promise.all([
    db.customerAccount.findUnique({
      where: { customerId },
      include: { customer: { include: { favoriteTherapist: { select: { fullName: true } } } } },
    }),
    db.consentRecord.findFirst({
      where: { customerId, documentType: "MARKETING" },
      orderBy: { createdAt: "desc" },
      select: { granted: true, withdrawnAt: true },
    }),
  ]);
  if (!account) return null;
  return {
    fullName: account.customer.fullName,
    phone: account.phone,
    email: account.customer.email ?? "",
    birthDate: account.customer.birthday?.toISOString().slice(0, 10) ?? "",
    preferredPressure: account.customer.preferredPressure === "NHẸ" || account.customer.preferredPressure === "MẠNH" ? account.customer.preferredPressure : "VỪA",
    healthNotes: account.customer.healthNotes ?? "",
    bookingReminders: account.bookingReminders,
    promotionUpdates: Boolean(latestMarketing?.granted && !latestMarketing.withdrawnAt),
    totalVisits: account.customer.totalVisits,
    favoriteTherapist: account.customer.favoriteTherapist?.fullName ?? "Chưa chọn",
  };
}

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ authenticated: false, profile: null });
  return NextResponse.json({ authenticated: true, profile: await profileFor(session.customerId) });
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu cập nhật không hợp lệ." }, { status: 403 });
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Bạn cần đăng nhập để cập nhật hồ sơ." }, { status: 401 });
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin hồ sơ chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  const rateLimit = await consumeRateLimit({
    scope: "customer-profile-update",
    identifier: `${requestIp(request)}:${session.customerId}`,
    limit: 20,
    windowMs: 24 * 60 * 60_000,
  });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Bạn đã cập nhật quá nhiều lần. Vui lòng thử lại sau." }, { status: 429 });

  const currentMarketing = await db.consentRecord.findFirst({
    where: { customerId: session.customerId, documentType: "MARKETING" },
    orderBy: { createdAt: "desc" },
    select: { granted: true, withdrawnAt: true },
  });
  const currentMarketingValue = Boolean(currentMarketing?.granted && !currentMarketing.withdrawnAt);
  const now = new Date();
  const birthDate = parsed.data.birthDate ? new Date(`${parsed.data.birthDate}T00:00:00.000Z`) : null;
  if (birthDate && (Number.isNaN(birthDate.getTime()) || birthDate > now)) {
    return NextResponse.json({ error: "Ngày sinh chưa hợp lệ." }, { status: 400 });
  }
  const userAgent = request.headers.get("user-agent")?.trim();
  await db.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: session.customerId },
      data: {
        fullName: parsed.data.fullName,
        email: parsed.data.email || null,
        birthday: birthDate,
        preferredPressure: parsed.data.preferredPressure,
        healthNotes: parsed.data.healthNotes || null,
      },
    });
    await tx.customerAccount.update({
      where: { customerId: session.customerId },
      data: { bookingReminders: parsed.data.bookingReminders },
    });
    if (currentMarketingValue !== parsed.data.promotionUpdates) {
      if (!parsed.data.promotionUpdates) {
        await tx.consentRecord.updateMany({
          where: { customerId: session.customerId, documentType: "MARKETING", granted: true, withdrawnAt: null },
          data: { withdrawnAt: now },
        });
      }
      await tx.consentRecord.create({
        data: {
          customerId: session.customerId,
          ...legalDocumentEvidence("MARKETING"),
          source: "ACCOUNT_SETTINGS",
          granted: parsed.data.promotionUpdates,
          subjectHash: privateIdentifierDigest(session.phone),
          ipHash: privateIdentifierDigest(requestIp(request)),
          userAgentHash: userAgent ? privateIdentifierDigest(userAgent) : undefined,
          grantedAt: parsed.data.promotionUpdates ? now : null,
        },
      });
    }
  });
  return NextResponse.json({ saved: true, profile: await profileFor(session.customerId) });
}
