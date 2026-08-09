import { NextResponse } from "next/server";
import { customerAccountDto, deleteCustomerSession, getCustomerSession } from "@/lib/server/customer-session";
import { isSameOriginMutation } from "@/lib/server/request-security";

export async function GET() {
  const account = await getCustomerSession({ renew: true });
  return NextResponse.json({ account: account ? customerAccountDto(account) : null });
}

export async function DELETE(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  await deleteCustomerSession();
  return NextResponse.json({ ok: true });
}
