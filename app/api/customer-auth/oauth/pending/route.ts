import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  clearCustomerOAuthPending,
  getCustomerOAuthPendingIdentityId,
} from "@/lib/server/customer-oauth";
import { isSameOriginMutation } from "@/lib/server/request-security";

export async function GET() {
  const identityId = await getCustomerOAuthPendingIdentityId();
  if (!identityId) return NextResponse.json({ pending: null });
  const identity = await db.customerOAuthIdentity.findFirst({
    where: {
      id: identityId,
      customerId: null,
      pendingExpiresAt: { gt: new Date() },
    },
    select: { provider: true, displayName: true, email: true, avatarUrl: true },
  });
  if (!identity) {
    await clearCustomerOAuthPending();
    return NextResponse.json({ pending: null });
  }
  return NextResponse.json({ pending: identity });
}

export async function DELETE(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const identityId = await getCustomerOAuthPendingIdentityId();
  if (identityId) await db.customerOAuthIdentity.deleteMany({ where: { id: identityId, customerId: null } });
  await clearCustomerOAuthPending();
  return NextResponse.json({ ok: true });
}
