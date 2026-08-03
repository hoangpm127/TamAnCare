import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";
import { money, notifyOperations } from "@/lib/server/notification-service";
import {
  consumeRateLimit,
  isSameOriginMutation,
  privateIdentifierDigest,
  rateLimitIdentifier,
  requestIp,
} from "@/lib/server/request-security";

const categoryMap = {
  "Cơ sở vật chất": "FACILITIES",
  "Khấu hao tài sản": "DEPRECIATION",
  "Lương nhân sự": "SALARY",
  "Thưởng & hoa hồng": "BONUS",
  "Mặt bằng": "RENT",
  "Điện, nước & Internet": "UTILITIES",
  "Vật tư tiêu hao": "SUPPLIES",
  "Marketing & bán hàng": "MARKETING",
  "Bảo trì thiết bị": "MAINTENANCE",
  "Nền tảng & hệ thống": "SOFTWARE",
  "Thuế, phí & hành chính": "OTHER",
  "Chi phí khác": "OTHER",
} as const;

const schema = z.object({
  amount: z.coerce.number().int().positive().max(2_000_000_000),
  description: z.string().trim().min(3).max(500),
  categoryLabel: z.string().trim(),
  branchId: z.string().min(1),
  counterparty: z.string().trim().max(200).optional(),
  evidenceId: z.string().trim().max(64).optional(),
  confirmDuplicateEvidence: z.boolean().optional(),
  occurredAt: z.string().datetime().or(z.string().min(10)),
});

class EvidenceConflictError extends Error {}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Chỉ Admin và Quản lý cơ sở được ghi nhận chi phí." }, { status: 401 });
  const rateLimit = await consumeRateLimit({
    scope: "expense-create",
    identifier: rateLimitIdentifier(request, session.id),
    limit: 40,
    windowMs: 10 * 60_000,
    blockMs: 15 * 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Bạn ghi nhận quá nhiều khoản chi. Vui lòng thử lại sau." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Thông tin khoản chi chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  if (session.role !== "OWNER" && (input.branchId === "system" || input.branchId !== session.branchId)) {
    return NextResponse.json({ error: "Quản lý chỉ được hạch toán cho cơ sở mình phụ trách." }, { status: 403 });
  }
  const category = categoryMap[input.categoryLabel as keyof typeof categoryMap] ?? "OTHER";
  const [branches, evidence] = await Promise.all([
    db.branch.findMany({ where: input.branchId === "system" ? {} : { id: input.branchId }, orderBy: { id: "asc" } }),
    input.evidenceId ? db.expenseEvidence.findUnique({ where: { id: input.evidenceId } }) : null,
  ]);
  if (!branches.length) return NextResponse.json({ error: "Không tìm thấy cơ sở hạch toán." }, { status: 404 });
  if (input.evidenceId && !evidence) return NextResponse.json({ error: "Không tìm thấy ảnh bill đã tải." }, { status: 404 });
  if (evidence) {
    if (evidence.createdByUserId !== session.id) return NextResponse.json({ error: "Ảnh bill phải do chính tài khoản đang thao tác tải lên." }, { status: 403 });
    const expectedBranchId = input.branchId === "system" ? null : input.branchId;
    if (evidence.branchId !== expectedBranchId) return NextResponse.json({ error: "Ảnh bill không cùng phạm vi hạch toán với khoản chi." }, { status: 409 });
    if (evidence.usedAt) return NextResponse.json({ error: "Ảnh bill này đã được dùng cho một khoản chi khác." }, { status: 409 });
    const duplicate = await db.expenseEvidence.findFirst({
      where: { id: { not: evidence.id }, sha256: evidence.sha256, usedAt: { not: null } },
      select: { id: true },
    });
    if (duplicate && !input.confirmDuplicateEvidence) {
      return NextResponse.json({
        error: "Ảnh bill trùng với chứng từ đã hạch toán. Hãy kiểm tra và xác nhận nếu đây thực sự là khoản chi khác.",
        code: "DUPLICATE_EVIDENCE_CONFIRMATION_REQUIRED",
      }, { status: 409 });
    }
  }
  const totalSeats = branches.reduce((sum, item) => sum + item.seatCapacity, 0);
  let allocated = 0;

  let expenses;
  try {
    expenses = await db.$transaction(async (tx) => {
      if (evidence) {
        const claimed = await tx.expenseEvidence.updateMany({
          where: { id: evidence.id, usedAt: null },
          data: { usedAt: new Date(), scanStatus: "CONFIRMED" },
        });
        if (claimed.count !== 1) throw new EvidenceConflictError("Evidence was already used.");
      }
      const created = [];
      for (const [index, branch] of branches.entries()) {
        const amount = index === branches.length - 1 ? input.amount - allocated : Math.round((input.amount * branch.seatCapacity) / totalSeats);
        allocated += amount;
        const expense = await tx.expense.create({
          data: {
            branchId: branch.id,
            category,
            description: input.branchId === "system" ? `[Phân bổ hệ thống] ${input.description}` : input.description,
            amount,
            vendor: input.counterparty,
            evidenceId: evidence?.id,
            evidenceUrl: evidence ? `/api/expense-evidence/${evidence.id}` : undefined,
            occurredAt: new Date(input.occurredAt),
            createdByUserId: session.id,
          },
        });
        await tx.ledgerEntry.create({
          data: {
            branchId: branch.id,
            expenseId: expense.id,
            category: "OPERATING_EXPENSE",
            direction: "OUT",
            amount,
            description: expense.description,
            occurredAt: expense.occurredAt,
          },
        });
        created.push(expense);
      }
      await notifyOperations(tx, {
        branchId: input.branchId === "system" ? null : input.branchId,
        audience: "MANAGEMENT",
        type: "FINANCE",
        title: input.branchId === "system" ? "Đã ghi nhận chi phí toàn hệ thống" : "Đã ghi nhận chi phí phát sinh",
        body: `${input.description} · ${money(input.amount)} · ${input.categoryLabel} · thực hiện bởi ${session.displayName}.`,
        actionUrl: "/admin/finance",
      });
      await tx.adminAuditLog.create({
        data: {
          actorUserId: session.id,
          branchId: input.branchId === "system" ? null : input.branchId,
          action: "EXPENSE_CREATE",
          entityType: "ExpenseBatch",
          entityId: created[0]?.id,
          after: {
            requestedAmount: input.amount,
            category,
            description: input.description,
            allocation: created.map((item) => ({ expenseId: item.id, branchId: item.branchId, amount: item.amount })),
            evidenceId: evidence?.id ?? null,
            duplicateEvidenceConfirmed: Boolean(input.confirmDuplicateEvidence),
          },
          ipHash: privateIdentifierDigest(requestIp(request)),
        },
      });
      return created;
    });
  } catch (error) {
    if (error instanceof EvidenceConflictError) {
      return NextResponse.json({ error: "Ảnh bill vừa được dùng ở thao tác khác. Vui lòng tải lại dữ liệu." }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ persisted: true, expenses, allocation: input.branchId === "system" ? "Theo tỷ trọng sức chứa đang hoạt động của từng cơ sở" : "Trực tiếp theo cơ sở" }, { status: 201 });
}
