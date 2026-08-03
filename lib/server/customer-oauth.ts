import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import * as oauth from "oauth4webapi";
import { z } from "zod";
import { publicAppUrl } from "@/lib/public-app-url";
import { safeCustomerReturnPath } from "@/lib/safe-return-path";

export const CUSTOMER_OAUTH_STATE_COOKIE = "ta_customer_oauth_state";
export const CUSTOMER_OAUTH_PENDING_COOKIE = "ta_customer_oauth_pending";
export const CUSTOMER_OAUTH_PENDING_MINUTES = 15;

export type CustomerOAuthProviderSlug = "google" | "facebook";

export type CustomerOAuthProfile = {
  provider: "GOOGLE" | "FACEBOOK";
  providerAccountId: string;
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  avatarUrl: string | null;
};

const stateSchema = z.object({
  provider: z.enum(["google", "facebook"]),
  state: z.string().min(32),
  codeVerifier: z.string().min(43),
  nonce: z.string().min(32),
  returnTo: z.string().min(1).max(500),
  expiresAt: z.number().int().positive(),
});

const pendingSchema = z.object({
  identityId: z.string().min(1),
  expiresAt: z.number().int().positive(),
});

type OAuthState = z.infer<typeof stateSchema>;

function oauthSecret() {
  const secret = process.env.OAUTH_STATE_SECRET?.trim() || process.env.SESSION_SECRET?.trim();
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("OAUTH_STATE_SECRET hoặc SESSION_SECRET chưa được cấu hình.");
  }
  return secret ?? "tam-an-local-oauth-state-secret";
}

function secureCookies() {
  return process.env.SESSION_COOKIE_SECURE === undefined
    ? process.env.NODE_ENV === "production"
    : process.env.SESSION_COOKIE_SECURE === "true";
}

function expireOAuthCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, name: string) {
  cookieStore.set(name, "", {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    maxAge: 0,
    expires: new Date(0),
    path: "/api/customer-auth/oauth",
  });
}

function signPayload(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = createHmac("sha256", oauthSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readSignedPayload(value: string | undefined) {
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;
  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = createHmac("sha256", oauthSecret()).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

function callbackUrl(provider: CustomerOAuthProviderSlug, request: Request) {
  return publicAppUrl(`/api/customer-auth/oauth/${provider}/callback`, request).toString();
}

function providerMetadata(provider: CustomerOAuthProviderSlug) {
  if (provider === "google") {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) throw new Error("Google OAuth chưa được cấu hình.");
    const as: oauth.AuthorizationServer = {
      issuer: "https://accounts.google.com",
      authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      token_endpoint: "https://oauth2.googleapis.com/token",
      userinfo_endpoint: "https://openidconnect.googleapis.com/v1/userinfo",
      jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
      id_token_signing_alg_values_supported: ["RS256"],
    };
    return { as, client: { client_id: clientId } satisfies oauth.Client, clientSecret };
  }

  const clientId = process.env.FACEBOOK_APP_ID?.trim();
  const clientSecret = process.env.FACEBOOK_APP_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Facebook OAuth chưa được cấu hình.");
  const version = process.env.FACEBOOK_GRAPH_API_VERSION?.trim() || "v25.0";
  const as: oauth.AuthorizationServer = {
    issuer: "https://www.facebook.com",
    authorization_endpoint: `https://www.facebook.com/${version}/dialog/oauth`,
    token_endpoint: `https://graph.facebook.com/${version}/oauth/access_token`,
  };
  return { as, client: { client_id: clientId } satisfies oauth.Client, clientSecret, version };
}

export function parseCustomerOAuthProvider(value: string): CustomerOAuthProviderSlug | null {
  return value === "google" || value === "facebook" ? value : null;
}

export function customerOAuthIsConfigured(provider: CustomerOAuthProviderSlug) {
  return provider === "google"
    ? Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim())
    : Boolean(process.env.FACEBOOK_APP_ID?.trim() && process.env.FACEBOOK_APP_SECRET?.trim());
}

export function customerOAuthIsAvailable(provider: CustomerOAuthProviderSlug) {
  if (!customerOAuthIsConfigured(provider)) return false;
  const isProduction = process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";
  return provider !== "facebook" || !isProduction || process.env.FACEBOOK_LOGIN_PUBLIC === "true";
}

export async function createCustomerOAuthAuthorizationUrl(
  provider: CustomerOAuthProviderSlug,
  request: Request,
  returnTo?: string | null,
) {
  const { as, client } = providerMetadata(provider);
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const codeVerifier = oauth.generateRandomCodeVerifier();
  const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
  const authorizationUrl = new URL(as.authorization_endpoint!);
  authorizationUrl.searchParams.set("client_id", client.client_id);
  authorizationUrl.searchParams.set("redirect_uri", callbackUrl(provider, request));
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  if (provider === "google") {
    authorizationUrl.searchParams.set("scope", "openid email profile");
    authorizationUrl.searchParams.set("nonce", nonce);
    authorizationUrl.searchParams.set("prompt", "select_account");
  } else {
    authorizationUrl.searchParams.set("scope", "email public_profile");
    authorizationUrl.searchParams.set("auth_type", "rerequest");
    authorizationUrl.searchParams.set("return_scopes", "true");
  }

  const oauthState: OAuthState = {
    provider,
    state,
    codeVerifier,
    nonce,
    returnTo: safeCustomerReturnPath(returnTo),
    expiresAt: Date.now() + 10 * 60_000,
  };
  (await cookies()).set(CUSTOMER_OAUTH_STATE_COOKIE, signPayload(oauthState), {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/api/customer-auth/oauth",
    priority: "high",
  });
  return authorizationUrl;
}

export async function exchangeCustomerOAuthCallback(
  provider: CustomerOAuthProviderSlug,
  request: Request,
): Promise<CustomerOAuthProfile & { returnTo: string }> {
  const cookieStore = await cookies();
  const rawState = readSignedPayload(cookieStore.get(CUSTOMER_OAUTH_STATE_COOKIE)?.value);
  expireOAuthCookie(cookieStore, CUSTOMER_OAUTH_STATE_COOKIE);
  const oauthState = stateSchema.safeParse(rawState);
  if (!oauthState.success || oauthState.data.provider !== provider || oauthState.data.expiresAt <= Date.now()) {
    throw new Error("Phiên xác thực mạng xã hội không hợp lệ hoặc đã hết hạn.");
  }

  const { as, client, clientSecret, ...providerOptions } = providerMetadata(provider);
  const callbackParameters = oauth.validateAuthResponse(as, client, new URL(request.url), oauthState.data.state);
  const tokenResponse = await oauth.authorizationCodeGrantRequest(
    as,
    client,
    oauth.ClientSecretPost(clientSecret),
    callbackParameters,
    callbackUrl(provider, request),
    oauthState.data.codeVerifier,
  );
  const tokens = await oauth.processAuthorizationCodeResponse(
    as,
    client,
    tokenResponse,
    provider === "google" ? { expectedNonce: oauthState.data.nonce, requireIdToken: true } : undefined,
  );

  if (provider === "google") {
    const claims = oauth.getValidatedIdTokenClaims(tokens);
    if (!claims?.sub) throw new Error("Google không trả về định danh hợp lệ.");
    const userInfoResponse = await oauth.userInfoRequest(as, client, tokens.access_token);
    const profile = await oauth.processUserInfoResponse(as, client, claims.sub, userInfoResponse);
    return {
      provider: "GOOGLE",
      providerAccountId: profile.sub,
      displayName: typeof profile.name === "string" ? profile.name : null,
      email: typeof profile.email === "string" ? profile.email.toLowerCase() : null,
      emailVerified: profile.email_verified === true,
      avatarUrl: typeof profile.picture === "string" ? profile.picture : null,
      returnTo: oauthState.data.returnTo,
    };
  }

  const version = "version" in providerOptions ? providerOptions.version : "v25.0";
  const profileUrl = new URL(`https://graph.facebook.com/${version}/me`);
  profileUrl.searchParams.set("fields", "id,name,email,picture.type(large)");
  const profileResponse = await oauth.protectedResourceRequest(tokens.access_token, "GET", profileUrl);
  if (!profileResponse.ok) throw new Error("Không thể đọc hồ sơ Facebook.");
  const profile = z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1).optional(),
    email: z.string().email().optional(),
    picture: z.object({ data: z.object({ url: z.string().url().optional() }) }).optional(),
  }).parse(await profileResponse.json());
  return {
    provider: "FACEBOOK",
    providerAccountId: profile.id,
    displayName: profile.name ?? null,
    email: profile.email?.toLowerCase() ?? null,
    emailVerified: false,
    avatarUrl: profile.picture?.data.url ?? null,
    returnTo: oauthState.data.returnTo,
  };
}

export async function setCustomerOAuthPending(identityId: string) {
  const expiresAt = Date.now() + CUSTOMER_OAUTH_PENDING_MINUTES * 60_000;
  (await cookies()).set(CUSTOMER_OAUTH_PENDING_COOKIE, signPayload({ identityId, expiresAt }), {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    maxAge: CUSTOMER_OAUTH_PENDING_MINUTES * 60,
    path: "/api/customer-auth/oauth",
    priority: "high",
  });
  return new Date(expiresAt);
}

export async function getCustomerOAuthPendingIdentityId() {
  const payload = pendingSchema.safeParse(readSignedPayload((await cookies()).get(CUSTOMER_OAUTH_PENDING_COOKIE)?.value));
  if (!payload.success || payload.data.expiresAt <= Date.now()) return null;
  return payload.data.identityId;
}

export async function clearCustomerOAuthPending() {
  expireOAuthCookie(await cookies(), CUSTOMER_OAUTH_PENDING_COOKIE);
}
