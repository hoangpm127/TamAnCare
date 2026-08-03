import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publicAppUrl } from "@/lib/public-app-url";
import {
  exchangeCustomerOAuthCallback,
  parseCustomerOAuthProvider,
  setCustomerOAuthPending,
} from "@/lib/server/customer-oauth";
import { createCustomerSession, getCustomerSession } from "@/lib/server/customer-session";
import { safeCustomerReturnPath } from "@/lib/safe-return-path";

export const maxDuration = 15;

function accountRedirect(request: Request, params: Record<string, string>) {
  const url = publicAppUrl("/tai-khoan", request);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const provider = parseCustomerOAuthProvider((await context.params).provider);
  if (!provider) return NextResponse.json({ error: "Nhà cung cấp đăng nhập không hợp lệ." }, { status: 404 });

  if (new URL(request.url).searchParams.has("error")) {
    return accountRedirect(request, { oauthError: "cancelled", provider });
  }

  try {
    const exchange = await exchangeCustomerOAuthCallback(provider, request);
    const { returnTo, ...profile } = exchange;
    const now = new Date();
    const identity = await db.customerOAuthIdentity.upsert({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      create: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        email: profile.email,
        emailVerifiedAt: profile.emailVerified ? now : null,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        lastLoginAt: now,
      },
      update: {
        email: profile.email,
        emailVerifiedAt: profile.emailVerified ? now : undefined,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        lastLoginAt: now,
      },
    });
    const currentAccount = await getCustomerSession();

    if (identity.customerId) {
      if (currentAccount && currentAccount.customerId !== identity.customerId) {
        return accountRedirect(request, { oauthError: "already-linked", provider });
      }
      await createCustomerSession(identity.customerId);
      return NextResponse.redirect(publicAppUrl(safeCustomerReturnPath(returnTo), request));
    }

    if (currentAccount) {
      const linked = await db.customerOAuthIdentity.updateMany({
        where: { id: identity.id, customerId: null },
        data: { customerId: currentAccount.customerId, pendingExpiresAt: null, lastLoginAt: now },
      });
      if (linked.count !== 1) return accountRedirect(request, { oauthError: "already-linked", provider });
      if (profile.email) {
        await db.customer.updateMany({
          where: { id: currentAccount.customerId, email: null },
          data: { email: profile.email },
        });
      }
      await createCustomerSession(currentAccount.customerId);
      return NextResponse.redirect(publicAppUrl(safeCustomerReturnPath(returnTo), request));
    }

    const pendingExpiresAt = await setCustomerOAuthPending(identity.id);
    await db.customerOAuthIdentity.update({
      where: { id: identity.id },
      data: { pendingExpiresAt },
    });
    return accountRedirect(request, { oauth: "complete", provider, returnTo: safeCustomerReturnPath(returnTo) });
  } catch {
    return accountRedirect(request, { oauthError: "failed", provider });
  }
}
