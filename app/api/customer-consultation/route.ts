import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { notifyCustomer, notifyOperations } from "@/lib/server/notification-service";
import { getCustomerSession } from "@/lib/server/customer-session";
import { consumeRateLimit, isSameOriginMutation, requestIp } from "@/lib/server/request-security";

const responseSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("INTERESTED"),
    preferredTime: z.enum(["MORNING", "AFTERNOON", "EVENING"]),
  }),
  z.object({
    decision: z.literal("DECLINED"),
    preferredTime: z.null().optional(),
  }),
]);

const preferredTimeLabels = {
  MORNING: "Buổi sáng (08:00–12:00)",
  AFTERNOON: "Buổi chiều (12:00–18:00)",
  EVENING: "Buổi tối (18:00–21:00)",
} as const;

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  }
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Bạn cần đăng nhập để lưu lựa chọn." }, { status: 401 });
  }
  const parsed = responseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vui lòng chọn khung giờ liên hệ phù hợp." }, { status: 400 });
  }
  const rateLimit = await consumeRateLimit({
    scope: "customer-free-consultation",
    identifier: `${requestIp(request)}:${session.customerId}`,
    limit: 5,
    windowMs: 24 * 60 * 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    const updated = await tx.customerAccount.updateMany({
      where: {
        customerId: session.customerId,
        freeConsultationEligible: true,
        freeConsultationDecision: null,
      },
      data: {
        freeConsultationDecision: parsed.data.decision,
        freeConsultationPreferredTime: parsed.data.decision === "INTERESTED" ? parsed.data.preferredTime : null,
        freeConsultationRespondedAt: now,
      },
    });
    if (updated.count === 0) {
      const existing = await tx.customerAccount.findUnique({
        where: { customerId: session.customerId },
        select: { freeConsultationDecision: true },
      });
      return { decision: existing?.freeConsultationDecision ?? null, saved: false };
    }

    if (parsed.data.decision === "INTERESTED") {
      const preferredTime = preferredTimeLabels[parsed.data.preferredTime];
      await notifyCustomer(tx, session.customerId, {
        type: "INVITATION",
        title: "Đã đăng ký tư vấn miễn phí",
        body: `Tâm An Center đã ghi nhận khung giờ liên hệ: ${preferredTime}. Đội ngũ sẽ liên hệ để xác nhận lịch phù hợp.`,
        actionUrl: "/thong-bao",
      });
      await notifyOperations(tx, {
        type: "INVITATION",
        title: `Tư vấn miễn phí · ${session.customer.fullName}`,
        body: `${session.phone} đăng ký đánh giá đau mỏi cổ vai gáy/cơ xương khớp · ${preferredTime}.`,
        actionUrl: "/admin/customers",
      });
    }

    return { decision: parsed.data.decision, saved: true };
  });

  return NextResponse.json({ ok: true, ...result });
}
