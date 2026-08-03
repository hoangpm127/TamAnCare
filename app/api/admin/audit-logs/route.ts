import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER"]);
  if (!session) return NextResponse.json({ error: "Bạn không có quyền xem nhật ký quản trị." }, { status: 401 });
  const url = new URL(request.url);
  const requestedBranch = url.searchParams.get("branchId");
  const branchId = session.role === "OWNER"
    ? (requestedBranch && requestedBranch !== "all" ? requestedBranch : undefined)
    : session.branchId ?? "__none__";
  const action = url.searchParams.get("action")?.trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 300);
  const logs = await db.adminAuditLog.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
    },
    include: { actor: { select: { name: true, role: true } }, branch: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ logs }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
