import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";
import { RefundWorkflowError, transitionRefundRequest } from "@/lib/server/refund-service";
import {
  consumeRateLimit,
  isSameOriginMutation,
  privateIdentifierDigest,
  requestIp,
} from "@/lib/server/request-security";

const transitionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "COMPLETE", "CANCEL"]),
  note: z.string().trim().min(3).max(500).optional(),
  bankReference: z.string().trim().min(4).max(120).regex(/^[\p{L}\p{N}._/-]+$/u).optional(),
}).superRefine((value, context) => {
  if (value.action === "COMPLETE" && !value.bankReference) {
    context.addIssue({ code: "custom", path: ["bankReference"], message: "Cần mã giao dịch ngân hàng." });
  }
  if (value.action === "REJECT" && !value.note) {
    context.addIssue({ code: "custom", path: ["note"], message: "Cần nêu lý do từ chối." });
  }
});

export async function PATCH(request: Request, context: { params: Promise<{ requestId: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER"]);
  if (!session) return NextResponse.json({ error: "Bạn không có quyền xử lý hoàn tiền." }, { status: 401 });
  const parsed = transitionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thao tác hoàn tiền chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.action !== "CANCEL" && session.role !== "OWNER") {
    return NextResponse.json({ error: "Chỉ Chủ Tâm An được duyệt, từ chối hoặc xác nhận đã chuyển hoàn tiền." }, { status: 403 });
  }
  const rateLimit = await consumeRateLimit({ scope: "refund-transition", identifier: session.id, limit: 40, windowMs: 60 * 60_000 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Đã thao tác quá nhiều lần; vui lòng kiểm tra lại trước khi tiếp tục." }, { status: 429 });
  const { requestId } = await context.params;
  try {
    const refund = await db.$transaction(
      (tx) => transitionRefundRequest(tx, {
        requestId,
        ...parsed.data,
        ipHash: privateIdentifierDigest(requestIp(request)),
      }, session),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return NextResponse.json({ persisted: true, refund });
  } catch (error) {
    if (error instanceof RefundWorkflowError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      return NextResponse.json({ error: error.code === "P2002" ? "Mã giao dịch ngân hàng đã được sử dụng." : "Dữ liệu vừa thay đổi; vui lòng tải lại." }, { status: 409 });
    }
    console.error("refund.transition_failed", error);
    return NextResponse.json({ error: "Không thể cập nhật yêu cầu hoàn tiền." }, { status: 503 });
  }
}
