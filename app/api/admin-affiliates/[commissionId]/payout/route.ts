import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { AFFILIATE_RECONCILIATION_DAYS } from "@/lib/referral-policy";
import { requireAdminSession } from "@/lib/server/admin-session";
import { notifyCustomer } from "@/lib/server/notification-service";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

const DAY_MS = 24 * 60 * 60 * 1000;
const payoutSchema = z.object({
  transferReference: z.string().trim().max(100).optional().default(""),
  note: z.string().trim().max(300).optional().default(""),
});

function money(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value) + "đ";
}

export async function PATCH(request: Request, context: { params: Promise<{ commissionId: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER"]);
  if (!session) return NextResponse.json({ error: "Chỉ Admin toàn hệ thống được xác nhận chuyển khoản Affiliate." }, { status: 403 });
  const parsed = payoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin chuyển khoản chưa hợp lệ." }, { status: 400 });
  const { commissionId } = await context.params;

  const commission = await db.ledgerEntry.findFirst({
    where: {
      id: commissionId,
      category: "OPERATING_EXPENSE",
      direction: "OUT",
      description: { startsWith: "Hoa hồng Affiliate" },
      customerId: { not: null },
    },
    include: {
      affiliatePayout: true,
      customer: {
        select: {
          id: true,
          fullName: true,
          account: { select: { affiliateBankName: true, affiliateBankAccount: true, affiliateBankHolder: true } },
        },
      },
    },
  });
  if (!commission?.customerId || !commission.customer) return NextResponse.json({ error: "Không tìm thấy bút toán hoa hồng Affiliate." }, { status: 404 });
  if (commission.affiliatePayout?.status === "PAID") {
    return NextResponse.json({ paid: true, alreadyPaid: true, payout: commission.affiliatePayout });
  }

  const now = new Date();
  const account = commission.customer.account;
  const payout = await db.$transaction(async (tx) => {
    const updated = commission.affiliatePayout
      ? await tx.affiliatePayout.update({
          where: { id: commission.affiliatePayout.id },
          data: {
            status: "PAID",
            paidAt: now,
            paidByUserId: session.id,
            bankNameSnapshot: account?.affiliateBankName ?? null,
            bankAccountSnapshot: account?.affiliateBankAccount ?? null,
            bankHolderSnapshot: account?.affiliateBankHolder ?? null,
            transferReference: parsed.data.transferReference || null,
            note: parsed.data.note || null,
          },
        })
      : await tx.affiliatePayout.create({
          data: {
            commissionLedgerEntryId: commission.id,
            affiliateCustomerId: commission.customerId!,
            branchId: commission.branchId,
            status: "PAID",
            dueAt: new Date(commission.occurredAt.getTime() + AFFILIATE_RECONCILIATION_DAYS * DAY_MS),
            paidAt: now,
            paidByUserId: session.id,
            bankNameSnapshot: account?.affiliateBankName ?? null,
            bankAccountSnapshot: account?.affiliateBankAccount ?? null,
            bankHolderSnapshot: account?.affiliateBankHolder ?? null,
            transferReference: parsed.data.transferReference || null,
            note: parsed.data.note || null,
          },
        });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: commission.branchId,
        action: "AFFILIATE_COMMISSION_PAID",
        entityType: "AffiliatePayout",
        entityId: updated.id,
        before: commission.affiliatePayout ? {
          id: commission.affiliatePayout.id,
          status: commission.affiliatePayout.status,
          dueAt: commission.affiliatePayout.dueAt.toISOString(),
          paidAt: commission.affiliatePayout.paidAt?.toISOString() ?? null,
          transferReference: commission.affiliatePayout.transferReference,
        } : undefined,
        after: {
          commissionLedgerEntryId: commission.id,
          affiliateCustomerId: commission.customerId,
          amount: commission.amount,
          paidAt: now.toISOString(),
          transferReference: parsed.data.transferReference || null,
          bankName: account?.affiliateBankName ?? null,
          bankAccount: account?.affiliateBankAccount ?? null,
          bankHolder: account?.affiliateBankHolder ?? null,
        },
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    await notifyCustomer(tx, commission.customerId!, {
      branchId: commission.branchId,
      type: "FINANCE",
      title: `Đã chuyển hoa hồng Affiliate ${money(commission.amount)}`,
      body: parsed.data.transferReference
        ? `Tâm An đã đối soát khoản hoa hồng với mã chuyển khoản ${parsed.data.transferReference}.`
        : "Tâm An đã hoàn tất chuyển khoản hoa hồng Affiliate của bạn.",
      actionUrl: "/vi?tab=income",
    });
    return updated;
  });

  return NextResponse.json({ paid: true, alreadyPaid: false, payout });
}
