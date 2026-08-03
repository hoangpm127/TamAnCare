import { NextResponse } from "next/server";
import { deleteAdminSession, getAdminSession } from "@/lib/server/admin-session";
import { isSameOriginMutation } from "@/lib/server/request-security";

export async function GET() {
  return NextResponse.json({ account: await getAdminSession() });
}

export async function DELETE(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Yêu cầu đăng xuất không hợp lệ." }, { status: 403 });
  }
  await deleteAdminSession();
  return NextResponse.json({ ok: true });
}
