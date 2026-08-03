import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";
import {
  detectSupportedImageMime,
  extractExpenseEvidence,
  extractionDate,
  MAX_EXPENSE_EVIDENCE_BYTES,
  sanitizeEvidenceFileName,
  sha256Hex,
} from "@/lib/server/expense-evidence";
import {
  consumeRateLimit,
  isSameOriginMutation,
  privateIdentifierDigest,
  rateLimitIdentifier,
  requestIp,
} from "@/lib/server/request-security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER"]);
  if (!session) return NextResponse.json({ error: "Chỉ Admin và Quản lý cơ sở được tải chứng từ." }, { status: 401 });

  const rateLimit = await consumeRateLimit({
    scope: "expense-evidence-upload",
    identifier: rateLimitIdentifier(request, session.id),
    limit: 12,
    windowMs: 10 * 60_000,
    blockMs: 15 * 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Bạn tải quá nhiều chứng từ. Vui lòng thử lại sau." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_EXPENSE_EVIDENCE_BYTES + 512_000) {
    return NextResponse.json({ error: "Ảnh bill tối đa 5 MB." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Không đọc được tệp tải lên." }, { status: 400 });
  }
  const file = form.get("file");
  const branchId = String(form.get("branchId") ?? "").trim();
  if (!(file instanceof File) || !branchId) {
    return NextResponse.json({ error: "Vui lòng chọn ảnh bill và phạm vi hạch toán." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_EXPENSE_EVIDENCE_BYTES) {
    return NextResponse.json({ error: "Ảnh bill phải có dung lượng từ 1 byte đến 5 MB." }, { status: 413 });
  }
  if (session.role !== "OWNER" && (branchId === "system" || branchId !== session.branchId)) {
    return NextResponse.json({ error: "Quản lý chỉ được tải chứng từ cho cơ sở mình phụ trách." }, { status: 403 });
  }
  const branch = branchId === "system" ? null : await db.branch.findUnique({ where: { id: branchId }, select: { id: true } });
  if (branchId !== "system" && !branch) return NextResponse.json({ error: "Không tìm thấy cơ sở hạch toán." }, { status: 404 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = detectSupportedImageMime(bytes);
  if (!mimeType) {
    return NextResponse.json({ error: "Chỉ nhận ảnh JPG, PNG hoặc WEBP hợp lệ; không nhận SVG hay tệp đổi đuôi." }, { status: 415 });
  }
  const sha256 = sha256Hex(bytes);
  const duplicate = await db.expenseEvidence.findFirst({
    where: { sha256, usedAt: { not: null } },
    select: { id: true },
  });
  const evidence = await db.expenseEvidence.create({
    data: {
      branchId: branch?.id,
      createdByUserId: session.id,
      originalName: sanitizeEvidenceFileName(file.name),
      mimeType,
      sizeBytes: bytes.byteLength,
      sha256,
      data: Buffer.from(bytes),
      scanStatus: process.env.OPENAI_API_KEY?.trim() ? "UPLOADED" : "AI_UNAVAILABLE",
    },
  });

  let extraction = null;
  let scanStatus: "AI_REVIEW_READY" | "AI_UNAVAILABLE" | "AI_FAILED" = process.env.OPENAI_API_KEY?.trim()
    ? "AI_FAILED"
    : "AI_UNAVAILABLE";
  try {
    extraction = await extractExpenseEvidence(bytes, mimeType, privateIdentifierDigest(session.id));
    if (extraction) scanStatus = "AI_REVIEW_READY";
  } catch {
    scanStatus = "AI_FAILED";
  }

  const updated = await db.$transaction(async (tx) => {
    const saved = await tx.expenseEvidence.update({
      where: { id: evidence.id },
      data: extraction ? {
        scanStatus,
        extractedAmount: extraction.amount && extraction.amount > 0 ? extraction.amount : null,
        extractedVendor: extraction.vendor,
        extractedDate: extractionDate(extraction.transactionDate),
        extractedCategory: extraction.category,
        documentType: extraction.documentType,
        confidence: extraction.confidence,
        scanNote: extraction.note,
        aiModel: extraction.model,
        aiResponseId: extraction.responseId,
      } : { scanStatus },
      select: {
        id: true,
        originalName: true,
        scanStatus: true,
        extractedAmount: true,
        extractedVendor: true,
        extractedDate: true,
        extractedCategory: true,
        documentType: true,
        confidence: true,
        scanNote: true,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: branch?.id,
        action: "EXPENSE_EVIDENCE_UPLOAD",
        entityType: "ExpenseEvidence",
        entityId: evidence.id,
        after: {
          originalName: evidence.originalName,
          mimeType,
          sizeBytes: bytes.byteLength,
          sha256,
          scanStatus,
          duplicateWarning: Boolean(duplicate),
        },
        ipHash: privateIdentifierDigest(requestIp(request)),
      },
    });
    return saved;
  });

  return NextResponse.json({
    persisted: true,
    evidence: {
      ...updated,
      url: `/api/expense-evidence/${updated.id}`,
      duplicateWarning: Boolean(duplicate),
      aiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    },
  }, { status: 201, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
