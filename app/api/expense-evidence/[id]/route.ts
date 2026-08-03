import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER"]);
  if (!session) return NextResponse.json({ error: "Bạn không có quyền xem chứng từ." }, { status: 401 });
  const { id } = await context.params;
  const evidence = await db.expenseEvidence.findUnique({
    where: { id },
    select: { branchId: true, originalName: true, mimeType: true, data: true },
  });
  if (!evidence) return NextResponse.json({ error: "Không tìm thấy chứng từ." }, { status: 404 });
  if (session.role !== "OWNER" && evidence.branchId !== session.branchId) {
    return NextResponse.json({ error: "Bạn không có quyền xem chứng từ của cơ sở khác." }, { status: 403 });
  }
  const encodedName = encodeURIComponent(evidence.originalName).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return new Response(new Uint8Array(evidence.data), {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `inline; filename*=UTF-8''${encodedName}`,
      "Content-Length": String(evidence.data.byteLength),
      "Content-Type": evidence.mimeType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
