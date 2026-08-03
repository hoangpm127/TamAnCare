import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";
import { createRefundRequest, RefundWorkflowError } from "@/lib/server/refund-service";
import {
  consumeRateLimit,
  isSameOriginMutation,
  privateIdentifierDigest,
  requestIp,
} from "@/lib/server/request-security";

const createSchema = z.object({
  sourcePaymentId: z.string().uuid().or(z.string().cuid()),
  amount: z.coerce.number().int().positive().max(2_000_000_000),
  reason: z.string().trim().min(10).max(500),
});

export async function GET() {
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER"]);
  if (!session) return NextResponse.json({ error: "Chỉ Chủ và Quản lý cơ sở được xem hoàn tiền." }, { status: 401 });
  const branchWhere = session.role === "OWNER" ? {} : { branchId: session.branchId ?? "__none__" };
  const [requests, sources] = await Promise.all([
    db.refundRequest.findMany({
      where: branchWhere,
      include: {
        branch: { select: { name: true } },
        customer: { select: { fullName: true, phone: true } },
        requestedBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        completedBy: { select: { name: true } },
        sourcePayment: {
          include: {
            bookingGroup: { select: { referenceCode: true } },
            booking: { select: { bookingCode: true } },
          },
        },
        refundPayment: { select: { status: true, paidAt: true, externalReference: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 150,
    }),
    db.paymentTransaction.findMany({
      where: {
        ...branchWhere,
        direction: "IN",
        status: "CONFIRMED",
        type: { in: ["DEPOSIT", "SERVICE_PAYMENT"] },
        amount: { gt: 0 },
        customerPackage: null,
      },
      include: {
        branch: { select: { name: true } },
        customer: { select: { fullName: true, phone: true } },
        bookingGroup: { select: { referenceCode: true } },
        booking: { select: { bookingCode: true } },
        refundRequestsSource: {
          where: { status: { in: ["REQUESTED", "APPROVED", "COMPLETED"] } },
          select: { amount: true },
        },
      },
      orderBy: { paidAt: "desc" },
      take: 250,
    }),
  ]);
  return NextResponse.json({
    role: session.role,
    actorId: session.id,
    requests: requests.map((item) => ({
      id: item.id,
      status: item.status,
      amount: item.amount,
      reason: item.reason,
      branchId: item.branchId,
      branchName: item.branch.name,
      customerName: item.customer?.fullName ?? "Khách Tâm An",
      customerPhone: item.customer?.phone ?? "",
      referenceCode: item.sourcePayment.bookingGroup?.referenceCode ?? item.sourcePayment.booking?.bookingCode ?? item.sourcePayment.paymentCode ?? "Giao dịch dịch vụ",
      sourceType: item.sourcePayment.type,
      sourceAmount: item.sourcePayment.amount,
      requestedById: item.requestedByUserId,
      requestedByName: item.requestedBy.name,
      approvedByName: item.approvedBy?.name,
      completedByName: item.completedBy?.name,
      approvalNote: item.approvalNote,
      bankReference: item.bankReference,
      createdAt: item.createdAt.toISOString(),
      approvedAt: item.approvedAt?.toISOString(),
      completedAt: item.completedAt?.toISOString(),
      refundPaymentStatus: item.refundPayment?.status,
    })),
    sources: sources.map((item) => {
      const reserved = item.refundRequestsSource.reduce((sum, refund) => sum + refund.amount, 0);
      return {
        id: item.id,
        type: item.type,
        amount: item.amount,
        refundableAmount: Math.max(0, item.amount - reserved),
        branchId: item.branchId,
        branchName: item.branch.name,
        customerName: item.customer?.fullName ?? "Khách Tâm An",
        customerPhone: item.customer?.phone ?? "",
        referenceCode: item.bookingGroup?.referenceCode ?? item.booking?.bookingCode ?? item.paymentCode ?? "Giao dịch dịch vụ",
        paidAt: item.paidAt?.toISOString() ?? item.createdAt.toISOString(),
      };
    }).filter((item) => item.refundableAmount > 0),
  });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER"]);
  if (!session) return NextResponse.json({ error: "Chỉ Chủ và Quản lý cơ sở được lập yêu cầu hoàn tiền." }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin hoàn tiền chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  const rateLimit = await consumeRateLimit({ scope: "refund-create", identifier: session.id, limit: 20, windowMs: 60 * 60_000 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Đã lập quá nhiều yêu cầu; vui lòng kiểm tra lại sổ trước khi tiếp tục." }, { status: 429 });
  try {
    const refund = await db.$transaction(
      (tx) => createRefundRequest(tx, { ...parsed.data, ipHash: privateIdentifierDigest(requestIp(request)) }, session),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return NextResponse.json({ persisted: true, refund }, { status: 201 });
  } catch (error) {
    if (error instanceof RefundWorkflowError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json({ error: "Dữ liệu vừa thay đổi; vui lòng tải lại và thử lại." }, { status: 409 });
    }
    console.error("refund.create_failed", error);
    return NextResponse.json({ error: "Không thể lập yêu cầu hoàn tiền." }, { status: 503 });
  }
}
