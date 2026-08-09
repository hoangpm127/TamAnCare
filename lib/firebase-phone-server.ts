import "server-only";

import { normalizeVietnamPhone } from "@/lib/server/phone-otp";

export type FirebasePhonePublicConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
};

type FirebaseLookupResponse = {
  users?: Array<{
    localId?: string;
    phoneNumber?: string;
  }>;
};

export function firebasePhonePublicConfig(): FirebasePhonePublicConfig | null {
  const apiKey = process.env.FIREBASE_PHONE_API_KEY?.trim();
  const authDomain = process.env.FIREBASE_PHONE_AUTH_DOMAIN?.trim();
  const projectId = process.env.FIREBASE_PHONE_PROJECT_ID?.trim();
  const appId = process.env.FIREBASE_PHONE_APP_ID?.trim();
  const messagingSenderId = process.env.FIREBASE_PHONE_MESSAGING_SENDER_ID?.trim();
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return { apiKey, authDomain, projectId, appId, ...(messagingSenderId ? { messagingSenderId } : {}) };
}

function decodedAuthTime(idToken: string) {
  try {
    const encodedPayload = idToken.split(".")[1];
    if (!encodedPayload) return null;
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as { auth_time?: unknown };
    return typeof payload.auth_time === "number" ? payload.auth_time : null;
  } catch {
    return null;
  }
}

export async function verifyFirebasePhoneIdToken(idToken: string) {
  const config = firebasePhonePublicConfig();
  if (!config || idToken.length < 100 || idToken.length > 8_192) return null;
  const authTime = decodedAuthTime(idToken);
  const nowSeconds = Math.floor(Date.now() / 1_000);
  if (authTime === null || authTime > nowSeconds + 120 || nowSeconds - authTime > 10 * 60) return null;

  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(config.apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as FirebaseLookupResponse;
    const user = payload.users?.[0];
    if (!user?.localId || !user.phoneNumber) return null;
    return {
      uid: user.localId,
      phone: normalizeVietnamPhone(user.phoneNumber),
      authTime,
    };
  } catch {
    return null;
  }
}
