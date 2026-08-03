import { NextResponse } from "next/server";
import { z } from "zod";
import { changeAdminPassword, getAdminSession } from "@/lib/server/admin-session";
import { db } from "@/lib/db";
import { consumeRateLimit, isSameOriginMutation, privateIdentifierDigest, rateLimitIdentifier, requestIp } from "@/lib/server/request-security";

const strongPassword = z.string().min(12).max(200)
  .regex(/[a-z]/, "Cần có chữ thường.")
  .regex(/[A-Z]/, "Cần có chữ hoa.")
  .regex(/[0-9]/, "Cần có chữ số.")
  .regex(/[^A-Za-z0-9]/, "Cần có ký tự đặc biệt.");

const schema = z.object({
  currentPassword: z.string().min(8).max(200),
  nextPassword: strongPassword,
}).refine((value) => value.currentPassword !== value.nextPassword, {
  message: "Mật khẩu mới phải khác mật khẩu hiện tại.",
  path: ["nextPassword"],
});

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Yêu cầu đổi mật khẩu không hợp lệ." }, { status: 403 });
  }
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn." }, { status: 401 });

  const limit = await consumeRateLimit({
    scope: "admin-password-change",
    identifier: rateLimitIdentifier(request, session.id),
    limit: 5,
    windowMs: 30 * 60_000,
    blockMs: 60 * 60_000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Đã có quá nhiều lần thử. Vui lòng thử lại sau." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Mật khẩu mới chưa đạt yêu cầu." }, { status: 400 });
  }
  const account = await changeAdminPassword(session.id, parsed.data.currentPassword, parsed.data.nextPassword);
  if (!account) return NextResponse.json({ error: "Mật khẩu hiện tại chưa đúng." }, { status: 401 });
  await db.adminAuditLog.create({
    data: {
      actorUserId: session.id,
      branchId: session.branchId,
      action: "ADMIN_PASSWORD_CHANGE",
      entityType: "User",
      entityId: session.id,
      after: { otherSessionsRevoked: true },
      ipHash: privateIdentifierDigest(requestIp(request)),
    },
  });
  return NextResponse.json({ persisted: true, account });
}
