import "server-only";

import { firebasePhonePublicConfig } from "@/lib/firebase-phone-server";

export type OtpDeliveryTemplate =
  | "TAMAN_PHONE_VERIFICATION"
  | "TAMAN_PASSWORD_RESET";

export type OtpDeliveryResult = {
  status: "PENDING" | "SENT" | "TEST_MODE";
  reference: string;
};

type OtpDeliveryInput = {
  requestId: string;
  phone: string;
  code: string;
  expiresMinutes: number;
  templateId: OtpDeliveryTemplate;
};

type EsmsResponse = {
  CodeResult?: string | number;
  SMSID?: string;
  ErrorMessage?: string;
};

type EsmsDeliveryStatusResponse = {
  CodeResponse?: string | number;
  SendStatus?: string | number;
  SendSuccess?: string | number;
  SendFailed?: string | number;
};

type EsmsTemplate = {
  NetworkID?: number;
  TempContent?: string;
  TempId?: number;
  TempName?: string;
};

type EsmsTemplateResponse = {
  BrandnameTemplates?: EsmsTemplate[];
  CodeResult?: string | number;
  ErrorMessage?: string;
};

type SpeedSmsResponse = {
  status?: string;
  code?: string | number;
  message?: string;
  data?: {
    tranId?: string | number;
    invalidPhone?: string[];
  };
};

export type OtpDeliveryReadiness = {
  state: "READY" | "DISABLED" | "PENDING_TEMPLATE" | "MISCONFIGURED" | "PROVIDER_UNAVAILABLE";
  provider: "ESMS" | "SPEEDSMS" | "FIREBASE" | "WEBHOOK" | "DISABLED" | "TEST_MODE";
  channel: "SMS" | "FIREBASE" | "WEBHOOK" | "TEST" | "NONE";
  detail: string;
  templateId?: number;
};

const ESMS_TEMPLATE_CACHE_MS = 60_000;
let esmsTemplateCache: { key: string; expiresAt: number; template: EsmsTemplate | null } | null = null;

function configuredProvider() {
  const explicit = process.env.OTP_PROVIDER?.trim().toUpperCase();
  if (explicit === "ESMS" || explicit === "SPEEDSMS" || explicit === "FIREBASE" || explicit === "WEBHOOK" || explicit === "DISABLED") return explicit;
  if (process.env.SPEEDSMS_ACCESS_TOKEN?.trim()) return "SPEEDSMS";
  if (process.env.ESMS_API_KEY?.trim() && process.env.ESMS_SECRET_KEY?.trim()) return "ESMS";
  if (process.env.OTP_DELIVERY_WEBHOOK_URL?.trim() && process.env.OTP_DELIVERY_WEBHOOK_TOKEN?.trim()) return "WEBHOOK";
  return "DISABLED";
}

export function otpDeliveryMode() {
  if (process.env.NODE_ENV !== "production" && /^\d{6}$/.test(process.env.PHONE_OTP_TEST_CODE?.trim() ?? "")) {
    return "TEST_MODE" as const;
  }
  const provider = configuredProvider();
  if (otpDeliveryAwaitingTemplateApproval()) {
    return "DISABLED" as const;
  }
  return provider;
}

export function otpDeliveryAwaitingTemplateApproval() {
  return configuredProvider() === "ESMS"
    && process.env.NODE_ENV === "production"
    && process.env.ESMS_TEMPLATES_APPROVED?.trim().toLowerCase() !== "true";
}

export function otpDeliveryConfigured() {
  return otpDeliveryMode() !== "DISABLED";
}

export function otpDeliveryTrackingConfigured() {
  if (otpDeliveryMode() !== "ESMS") return true;
  return Boolean(process.env.ESMS_CALLBACK_URL?.trim() && process.env.ESMS_CALLBACK_TOKEN?.trim());
}

export function phoneVerificationRequired() {
  return process.env.PHONE_VERIFICATION_REQUIRED?.trim().toLowerCase() === "true";
}

export function phoneVerificationOnSignupRequired() {
  return phoneVerificationRequired()
    && process.env.PHONE_VERIFICATION_ON_SIGNUP_REQUIRED?.trim().toLowerCase() === "true";
}

export function buildOtpSmsContent(code: string, expiresMinutes: number, smsType: "2" | "8" = "8") {
  if (smsType === "8") {
    return `Ma xac minh cua ban la ${code}. Hieu luc ${expiresMinutes} phut. Khong chia se ma nay.`;
  }
  return `TAM AN CENTER: Ma OTP ${code}. Hieu luc ${expiresMinutes} phut. Khong chia se ma nay.`;
}

function supportedOtpPlaceholder(content: string) {
  return /\{\{?(?:OTP|CODE|P)(?::\d+)?\}?\}/i.test(content);
}

function looksLikeOtpTemplate(content: string) {
  const normalized = content
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return supportedOtpPlaceholder(content) && (normalized.includes("otp") || normalized.includes("ma xac"));
}

function renderApprovedOtpTemplate(content: string, code: string) {
  return content.replace(/\{\{?(?:OTP|CODE|P)(?::\d+)?\}?\}/gi, code);
}

async function approvedEsmsOtpTemplate(apiKey: string, secretKey: string) {
  const smsType = process.env.ESMS_SMS_TYPE?.trim() === "2" ? "2" : "8";
  const brandname = process.env.ESMS_BRANDNAME?.trim() ?? "";
  const configuredTemplateId = Number(process.env.ESMS_OTP_TEMPLATE_ID?.trim() || 0);
  const cacheKey = `${smsType}:${brandname}:${configuredTemplateId || "auto"}`;
  if (esmsTemplateCache?.key === cacheKey && esmsTemplateCache.expiresAt > Date.now()) {
    return esmsTemplateCache.template;
  }

  const response = await fetch("https://rest.esms.vn/MainService.svc/json/GetTemplate/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ApiKey: apiKey, SecretKey: secretKey, Brandname: brandname, OAId: "", SmsType: smsType }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`ESMS_TEMPLATE_HTTP_${response.status}`);
  const payload = await response.json() as EsmsTemplateResponse;
  if (String(payload.CodeResult) !== "100") throw new Error(`ESMS_TEMPLATE_REJECTED_${payload.CodeResult ?? "UNKNOWN"}`);
  const templates = payload.BrandnameTemplates ?? [];
  const template = templates.find((item) => configuredTemplateId > 0 && item.TempId === configuredTemplateId && looksLikeOtpTemplate(item.TempContent ?? ""))
    ?? templates.find((item) => looksLikeOtpTemplate(item.TempContent ?? ""))
    ?? null;
  esmsTemplateCache = { key: cacheKey, expiresAt: Date.now() + ESMS_TEMPLATE_CACHE_MS, template };
  return template;
}

export async function inspectOtpDeliveryReadiness(): Promise<OtpDeliveryReadiness> {
  const mode = otpDeliveryMode();
  if (mode === "TEST_MODE") return { state: "READY", provider: "TEST_MODE", channel: "TEST", detail: "Kênh OTP kiểm thử cục bộ đã sẵn sàng." };
  if (mode === "DISABLED") {
    return {
      state: otpDeliveryAwaitingTemplateApproval() ? "PENDING_TEMPLATE" : "DISABLED",
      provider: configuredProvider(),
      channel: "NONE",
      detail: otpDeliveryAwaitingTemplateApproval() ? "eSMS chưa được xác nhận duyệt mẫu OTP." : "Chưa cấu hình kênh gửi OTP.",
    };
  }
  if (mode === "WEBHOOK") {
    return process.env.OTP_DELIVERY_WEBHOOK_URL?.trim() && process.env.OTP_DELIVERY_WEBHOOK_TOKEN?.trim()
      ? { state: "READY", provider: "WEBHOOK", channel: "WEBHOOK", detail: "Gateway OTP đã sẵn sàng." }
      : { state: "MISCONFIGURED", provider: "WEBHOOK", channel: "WEBHOOK", detail: "Gateway OTP thiếu URL hoặc token." };
  }
  if (mode === "FIREBASE") {
    return firebasePhonePublicConfig()
      ? { state: "READY", provider: "FIREBASE", channel: "FIREBASE", detail: "Firebase Phone Auth đã sẵn sàng cho SMS OTP." }
      : { state: "MISCONFIGURED", provider: "FIREBASE", channel: "FIREBASE", detail: "Thiếu cấu hình Firebase Phone Auth." };
  }
  if (mode === "SPEEDSMS") {
    const accessToken = process.env.SPEEDSMS_ACCESS_TOKEN?.trim();
    if (!accessToken) return { state: "MISCONFIGURED", provider: "SPEEDSMS", channel: "SMS", detail: "Thiếu access token SpeedSMS." };
    try {
      const response = await fetch("https://api.speedsms.vn/index.php/user/info", {
        headers: { Authorization: `Basic ${Buffer.from(`${accessToken}:x`).toString("base64")}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      const payload = await response.json() as { status?: string; data?: { balance?: string | number } };
      if (!response.ok || payload.status !== "success") {
        return { state: "PROVIDER_UNAVAILABLE", provider: "SPEEDSMS", channel: "SMS", detail: "SpeedSMS chưa chấp nhận access token." };
      }
      const balance = Number(payload.data?.balance ?? 0);
      return balance > 0
        ? { state: "READY", provider: "SPEEDSMS", channel: "SMS", detail: "SpeedSMS và số dư gửi OTP đã sẵn sàng." }
        : { state: "MISCONFIGURED", provider: "SPEEDSMS", channel: "SMS", detail: "Tài khoản SpeedSMS chưa có số dư." };
    } catch {
      return { state: "PROVIDER_UNAVAILABLE", provider: "SPEEDSMS", channel: "SMS", detail: "Không thể kết nối SpeedSMS." };
    }
  }

  const apiKey = process.env.ESMS_API_KEY?.trim();
  const secretKey = process.env.ESMS_SECRET_KEY?.trim();
  if (!apiKey || !secretKey) return { state: "MISCONFIGURED", provider: "ESMS", channel: "SMS", detail: "Thiếu khóa API eSMS." };
  if (process.env.NODE_ENV === "production" && process.env.ESMS_SANDBOX?.trim().toLowerCase() === "true") {
    return { state: "MISCONFIGURED", provider: "ESMS", channel: "SMS", detail: "eSMS vẫn đang ở Sandbox." };
  }
  if (!otpDeliveryTrackingConfigured()) {
    return { state: "MISCONFIGURED", provider: "ESMS", channel: "SMS", detail: "Thiếu callback xác nhận trạng thái gửi eSMS." };
  }
  try {
    const template = await approvedEsmsOtpTemplate(apiKey, secretKey);
    if (!template?.TempContent) {
      return { state: "PENDING_TEMPLATE", provider: "ESMS", channel: "SMS", detail: "Tài khoản eSMS chưa có mẫu OTP đã duyệt." };
    }
    return {
      state: "READY",
      provider: "ESMS",
      channel: "SMS",
      detail: "Mẫu OTP eSMS đã được đối chiếu trực tiếp.",
      templateId: template.TempId,
    };
  } catch {
    return { state: "PROVIDER_UNAVAILABLE", provider: "ESMS", channel: "SMS", detail: "Không thể đối chiếu mẫu OTP với eSMS." };
  }
}

async function getEsmsDeliveryStatus(reference: string, apiKey: string, secretKey: string) {
  const statusUrl = new URL("https://rest.esms.vn/MainService.svc/json/GetSendStatus");
  statusUrl.searchParams.set("RefId", reference);
  statusUrl.searchParams.set("ApiKey", apiKey);
  statusUrl.searchParams.set("SecretKey", secretKey);
  const response = await fetch(statusUrl, { cache: "no-store", signal: AbortSignal.timeout(5_000) });
  if (!response.ok) return "PENDING" as const;
  const payload = await response.json() as EsmsDeliveryStatusResponse;
  if (String(payload.CodeResponse) !== "100") return "PENDING" as const;
  const sendStatus = Number(payload.SendStatus ?? 0);
  const sendSuccess = Number(payload.SendSuccess ?? 0);
  const sendFailed = Number(payload.SendFailed ?? 0);
  if (sendStatus === 4 || (sendStatus === 5 && sendFailed > 0 && sendSuccess === 0)) return "FAILED" as const;
  if (sendStatus === 5 && sendSuccess > 0) return "SENT" as const;
  return "PENDING" as const;
}

export async function inspectEsmsDeliveryStatus(reference: string) {
  const apiKey = process.env.ESMS_API_KEY?.trim();
  const secretKey = process.env.ESMS_SECRET_KEY?.trim();
  if (!apiKey || !secretKey || !reference.trim()) return "PENDING" as const;
  return getEsmsDeliveryStatus(reference.trim(), apiKey, secretKey);
}

async function waitForEsmsDelivery(reference: string, apiKey: string, secretKey: string) {
  for (const delayMs of [350, 650]) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const status = await getEsmsDeliveryStatus(reference, apiKey, secretKey);
    if (status !== "PENDING") return status;
  }
  return "PENDING" as const;
}

async function deliverWithEsms(input: OtpDeliveryInput): Promise<OtpDeliveryResult> {
  const apiKey = process.env.ESMS_API_KEY?.trim();
  const secretKey = process.env.ESMS_SECRET_KEY?.trim();
  if (!apiKey || !secretKey) throw new Error("ESMS_NOT_CONFIGURED");

  const smsType = process.env.ESMS_SMS_TYPE?.trim() === "2" ? "2" : "8";
  const brandname = process.env.ESMS_BRANDNAME?.trim();
  if (smsType === "2" && !brandname) throw new Error("ESMS_BRANDNAME_REQUIRED");

  const callbackUrl = process.env.ESMS_CALLBACK_URL?.trim();
  if (!callbackUrl || !process.env.ESMS_CALLBACK_TOKEN?.trim()) throw new Error("ESMS_TRACKING_NOT_CONFIGURED");
  const approvedTemplate = await approvedEsmsOtpTemplate(apiKey, secretKey);
  if (!approvedTemplate?.TempContent) throw new Error("ESMS_TEMPLATE_NOT_APPROVED");
  const response = await fetch("https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ApiKey: apiKey,
      SecretKey: secretKey,
      Phone: input.phone,
      Content: renderApprovedOtpTemplate(approvedTemplate.TempContent, input.code),
      SmsType: smsType,
      IsUnicode: "0",
      Sandbox: process.env.ESMS_SANDBOX?.trim().toLowerCase() === "true" ? "1" : "0",
      RequestId: input.requestId.slice(0, 50),
      campaignid: input.templateId,
      ...(brandname ? { Brandname: brandname } : {}),
      ...(callbackUrl ? { CallbackUrl: callbackUrl } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`ESMS_HTTP_${response.status}`);
  const payload = await response.json() as EsmsResponse;
  if (String(payload.CodeResult) !== "100") throw new Error(`ESMS_REJECTED_${payload.CodeResult ?? "UNKNOWN"}`);
  const reference = payload.SMSID?.slice(0, 200);
  if (!reference) throw new Error("ESMS_MISSING_REFERENCE");
  const deliveryStatus = await waitForEsmsDelivery(reference, apiKey, secretKey);
  if (deliveryStatus === "FAILED") throw new Error("ESMS_DELIVERY_FAILED");
  return { status: deliveryStatus, reference };
}

async function deliverWithWebhook(input: OtpDeliveryInput): Promise<OtpDeliveryResult> {
  const webhookUrl = process.env.OTP_DELIVERY_WEBHOOK_URL?.trim();
  const webhookToken = process.env.OTP_DELIVERY_WEBHOOK_TOKEN?.trim();
  if (!webhookUrl || !webhookToken) throw new Error("OTP_WEBHOOK_NOT_CONFIGURED");
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${webhookToken}`,
    },
    body: JSON.stringify({
      requestId: input.requestId,
      recipient: input.phone,
      channel: "SMS",
      templateId: input.templateId,
      locale: "vi-VN",
      variables: { code: input.code, expiresMinutes: input.expiresMinutes },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`OTP_WEBHOOK_HTTP_${response.status}`);
  return {
    status: "SENT",
    reference: response.headers.get("x-request-id")?.slice(0, 200) ?? "webhook-accepted",
  };
}

async function deliverWithSpeedSms(input: OtpDeliveryInput): Promise<OtpDeliveryResult> {
  const accessToken = process.env.SPEEDSMS_ACCESS_TOKEN?.trim();
  if (!accessToken) throw new Error("SPEEDSMS_NOT_CONFIGURED");
  const smsType = process.env.SPEEDSMS_SMS_TYPE?.trim() === "4" ? 4 : 2;
  const phone = input.phone.startsWith("0") ? `84${input.phone.slice(1)}` : input.phone;
  const response = await fetch("https://api.speedsms.vn/index.php/sms/send", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accessToken}:x`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: [phone],
      content: buildOtpSmsContent(input.code, input.expiresMinutes, "8"),
      sms_type: smsType,
      sender: smsType === 4 ? (process.env.SPEEDSMS_SENDER?.trim() || "Verify") : "",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json() as SpeedSmsResponse;
  if (!response.ok || payload.status !== "success" || String(payload.code ?? "") !== "00") {
    throw new Error(`SPEEDSMS_REJECTED_${payload.code ?? "UNKNOWN"}`);
  }
  if ((payload.data?.invalidPhone?.length ?? 0) > 0) throw new Error("SPEEDSMS_INVALID_PHONE");
  const reference = String(payload.data?.tranId ?? "").slice(0, 200);
  if (!reference) throw new Error("SPEEDSMS_MISSING_REFERENCE");
  return { status: "SENT", reference };
}

export async function deliverOtpCode(input: OtpDeliveryInput): Promise<OtpDeliveryResult> {
  const mode = otpDeliveryMode();
  if (mode === "TEST_MODE") return { status: "TEST_MODE", reference: "local-test-channel" };
  if (mode === "ESMS") return deliverWithEsms(input);
  if (mode === "SPEEDSMS") return deliverWithSpeedSms(input);
  if (mode === "WEBHOOK") return deliverWithWebhook(input);
  if (mode === "FIREBASE") throw new Error("FIREBASE_CLIENT_VERIFICATION_REQUIRED");
  throw new Error("OTP_DELIVERY_DISABLED");
}
