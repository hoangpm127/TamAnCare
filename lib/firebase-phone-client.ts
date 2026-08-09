"use client";

import "client-only";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  inMemoryPersistence,
  RecaptchaVerifier,
  setPersistence,
  signInWithPhoneNumber,
  signOut,
} from "firebase/auth";
import type { ConfirmationResult } from "firebase/auth";

export type FirebasePhoneClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
};

export type FirebasePhoneConfirmation = {
  confirm: (code: string) => Promise<string>;
};

function firebasePhoneNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("84")) return `+${digits}`;
  if (digits.startsWith("0")) return `+84${digits.slice(1)}`;
  return `+84${digits}`;
}

function firebasePhoneError(reason: unknown) {
  const code = typeof reason === "object" && reason && "code" in reason ? String(reason.code) : "";
  if (code.includes("invalid-phone-number")) return "Số điện thoại chưa hợp lệ.";
  if (code.includes("invalid-verification-code")) return "Mã xác minh chưa đúng.";
  if (code.includes("code-expired") || code.includes("session-expired")) return "Mã xác minh đã hết hạn. Vui lòng gửi mã mới.";
  if (code.includes("too-many-requests")) return "Bạn đã yêu cầu mã quá nhiều lần. Vui lòng thử lại sau.";
  if (code.includes("quota-exceeded")) return "Hạn mức SMS hôm nay đã hết. Vui lòng liên hệ Tâm An Center để được hỗ trợ.";
  if (code.includes("captcha-check-failed") || code.includes("missing-app-credential")) return "Bước chống spam chưa hoàn tất. Vui lòng thử lại.";
  return reason instanceof Error && reason.message ? reason.message : "Chưa thể gửi hoặc xác minh mã SMS.";
}

export async function startFirebasePhoneVerification(
  config: FirebasePhoneClientConfig,
  phone: string,
  recaptchaContainerId: string,
): Promise<FirebasePhoneConfirmation> {
  try {
    const appName = "tam-an-phone-verification";
    const app = getApps().some((candidate) => candidate.name === appName)
      ? getApp(appName)
      : initializeApp(config, appName);
    const auth = getAuth(app);
    auth.languageCode = "vi";
    await setPersistence(auth, inMemoryPersistence);
    const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: "invisible" });
    let confirmation: ConfirmationResult;
    try {
      confirmation = await signInWithPhoneNumber(auth, firebasePhoneNumber(phone), verifier);
    } finally {
      verifier.clear();
    }
    return {
      async confirm(code: string) {
        try {
          const credential = await confirmation.confirm(code);
          const idToken = await credential.user.getIdToken();
          await signOut(auth).catch(() => undefined);
          return idToken;
        } catch (reason) {
          throw new Error(firebasePhoneError(reason));
        }
      },
    };
  } catch (reason) {
    throw new Error(firebasePhoneError(reason));
  }
}
