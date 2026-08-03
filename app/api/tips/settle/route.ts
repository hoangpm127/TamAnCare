import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";
import { money, notifyOperations, notifyTherapist } from "@/lib/server/notification-service";
import { consumeRateLimit, isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

const schema = z.object({
  branchId: z.string().optional(),
  through: z.string().datetime({ offset: true }).optional(),
});

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Chỉ Admin và Quản lý cơ sở được chốt Tip KTV." }, { status: 401 });
  const rateLimit = await consumeRateLimit({ scope: "tip-settle", identifier: session.id, limit: 10, windowMs: 60 * 60_000 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Đã chốt Tip quá nhiều lần; vui lòng kiểm tra sổ trước khi tiếp tục." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Phạm vi chốt Tip chưa hợp lệ." }, { status: 400 });

  const requestedBranch = parsed.data.branchId;
  if (session.role !== "OWNER" && requestedBranch && requestedBranch !== session.branchId) {
    return NextResponse.json({ error: "Quản lý chỉ được chốt Tip tại cơ sở mình phụ trách." }, { status: 403 });
  }
  const branchId = session.role === "OWNER" ? requestedBranch : session.branchId ?? undefined;
  const through = parsed.data.through ? new Date(parsed.data.through) : new Date();
  const pending = await db.tipPayout.findMany({
    where: { status: "PENDING", dueAt: { lte: through }, ...(branchId && branchId !== "all" ? { branchId } : {}) },
    include: { booking: true, officeEvent: true, therapist: true },
    orderBy: { dueAt: "asc" },
  });

  const paidAt = new Date();
  const settled = await db.$transaction(async (tx) => {
    const result = [];
    for (const item of pending) {
      const claimed = await tx.tipPayout.updateMany({
        where: { id: item.id, status: "PENDING" },
        data: { status: "PAID", paidAt },
      });
      if (claimed.count !== 1) continue;
      const payment = await tx.paymentTransaction.upsert({
        where: { idempotencyKey: `tip-payout:${item.id}` },
        create: {
          bookingId: item.bookingId,
          officeEventId: item.officeEventId,
          branchId: item.branchId,
          customerId: item.booking?.customerId ?? item.officeEvent?.customerId,
          type: "TIP",
          direction: "OUT",
          status: "CONFIRMED",
          amount: item.amount,
          method: "END_OF_DAY_TIP_PAYOUT",
          idempotencyKey: `tip-payout:${item.id}`,
          note: `Chi Tip cuối ngày cho ${item.therapist?.fullName ?? "KTV"}`,
          paidAt,
        },
        update: {},
      });
      const paidLedger = await tx.ledgerEntry.findFirst({
        where: { paymentTransactionId: payment.id, category: "TIP_PAID" },
        select: { id: true },
      });
      if (!paidLedger) {
        await tx.ledgerEntry.create({ data: {
          branchId: item.branchId,
          customerId: item.booking?.customerId ?? item.officeEvent?.customerId,
          bookingId: item.bookingId,
          officeEventId: item.officeEventId,
          paymentTransactionId: payment.id,
          category: "TIP_PAID",
          direction: "OUT",
          amount: item.amount,
          description: `Đã chi Tip KTV cuối ngày · ${item.therapist?.fullName ?? "KTV"}`,
          occurredAt: paidAt,
        } });
      }
      result.push(await tx.tipPayout.findUniqueOrThrow({ where: { id: item.id } }));
      await notifyTherapist(tx, {
        therapistName: item.therapist?.fullName,
        branchId: item.branchId,
        type: "FINANCE",
        title: `Tip ${money(item.amount)} đã được chi trả`,
        body: `Khoản Tip của ${item.booking?.bookingCode ?? item.officeEvent?.eventCode ?? "Tâm An Business"} đã chốt và thanh toán trong kỳ cuối ngày.`,
        actionUrl: "/therapist",
      });
    }
    const branchSummaries = new Map<string, { count: number; amount: number }>();
    for (const item of result) {
      const current = branchSummaries.get(item.branchId) ?? { count: 0, amount: 0 };
      branchSummaries.set(item.branchId, { count: current.count + 1, amount: current.amount + item.amount });
    }
    for (const [settledBranchId, summary] of branchSummaries) {
      await notifyOperations(tx, {
        branchId: settledBranchId,
        audience: "MANAGEMENT",
        type: "FINANCE",
        title: "Đã chốt Tip KTV cuối ngày",
        body: `${summary.count} khoản Tip · tổng ${money(summary.amount)} đã chuyển sang trạng thái đã chi.`,
        actionUrl: "/admin/finance",
      });
    }
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: branchId && branchId !== "all" ? branchId : null,
        action: "TIP_PAYOUT_SETTLE",
        entityType: "TipPayoutBatch",
        after: {
          through: through.toISOString(),
          count: result.length,
          amount: result.reduce((sum, item) => sum + item.amount, 0),
          payoutIds: result.map((item) => item.id),
        },
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    return result;
  });

  return NextResponse.json({
    persisted: true,
    settledCount: settled.length,
    settledAmount: settled.reduce((sum, item) => sum + item.amount, 0),
    paidAt: paidAt.toISOString(),
  });
}
