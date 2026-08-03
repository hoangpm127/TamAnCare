import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/server/customer-session";
import { legalDocumentEvidence } from "@/lib/server/legal-documents";
import { notifyCustomer } from "@/lib/server/notification-service";
import { consumeRateLimit, isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

const updateSchema = z.object({ marketingOptIn: z.boolean() });

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Bạn cần đăng nhập để xem lựa chọn riêng tư." }, { status: 401 });

  const records = await db.consentRecord.findMany({
    where: { customerId: session.customerId },
    orderBy: { createdAt: "desc" },
    select: {
      documentType: true,
      documentVersion: true,
      granted: true,
      grantedAt: true,
      withdrawnAt: true,
      createdAt: true,
    },
  });
  const latestMarketing = records.find((record) => record.documentType === "MARKETING");
  return NextResponse.json({
    marketingOptIn: Boolean(latestMarketing?.granted && !latestMarketing.withdrawnAt),
    latestMarketing,
    documents: {
      terms: legalDocumentEvidence("TERMS").documentVersion,
      privacy: legalDocumentEvidence("PRIVACY").documentVersion,
      bookingPolicy: legalDocumentEvidence("BOOKING_POLICY").documentVersion,
    },
  });
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu cập nhật không hợp lệ." }, { status: 403 });
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Bạn cần đăng nhập để cập nhật lựa chọn riêng tư." }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Lựa chọn tiếp thị chưa hợp lệ." }, { status: 400 });
  const rateLimit = await consumeRateLimit({
    scope: "customer-consent-update",
    identifier: `${requestIp(request)}:${session.customerId}`,
    limit: 10,
    windowMs: 24 * 60 * 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Bạn đã cập nhật quá nhiều lần. Vui lòng thử lại sau." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const now = new Date();
  const userAgent = request.headers.get("user-agent")?.trim();
  const evidence = legalDocumentEvidence("MARKETING");
  await db.$transaction(async (tx) => {
    if (!parsed.data.marketingOptIn) {
      await tx.consentRecord.updateMany({
        where: { customerId: session.customerId, documentType: "MARKETING", granted: true, withdrawnAt: null },
        data: { withdrawnAt: now },
      });
    }
    await tx.consentRecord.create({
      data: {
        customerId: session.customerId,
        ...evidence,
        source: "ACCOUNT_SETTINGS",
        granted: parsed.data.marketingOptIn,
        subjectHash: privateIdentifierDigest(session.phone),
        ipHash: privateIdentifierDigest(requestIp(request)),
        userAgentHash: userAgent ? privateIdentifierDigest(userAgent) : undefined,
        grantedAt: parsed.data.marketingOptIn ? now : null,
      },
    });
    await notifyCustomer(tx, session.customerId, {
      type: "SYSTEM",
      title: "Đã cập nhật lựa chọn riêng tư",
      body: parsed.data.marketingOptIn
        ? "Bạn đã chọn nhận thông tin ưu đãi và gợi ý chăm sóc từ Tâm An Center."
        : "Bạn đã rút lựa chọn nhận thông tin tiếp thị không thiết yếu.",
      actionUrl: "/tai-khoan",
    });
  });

  return NextResponse.json({ marketingOptIn: parsed.data.marketingOptIn });
}
