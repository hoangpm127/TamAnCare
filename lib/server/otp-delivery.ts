import "server-only";

export type OtpDeliveryTemplate =
  | "TUETAM_PHONE_VERIFICATION"
  | "TUETAM_PASSWORD_RESET";

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

function configuredProvider() {
  const explicit = process.env.OTP_PROVIDER?.trim().toUpperCase();
  if (explicit === "ESMS" || explicit === "WEBHOOK" || explicit === "DISABLED") return explicit;
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
  return `TAMANCARE: Ma OTP ${code}. Hieu luc ${expiresMinutes} phut. Khong chia se ma nay.`;
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
  const response = await fetch("https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ApiKey: apiKey,
      SecretKey: secretKey,
      Phone: input.phone,
      Content: buildOtpSmsContent(input.code, input.expiresMinutes, smsType),
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

export async function deliverOtpCode(input: OtpDeliveryInput): Promise<OtpDeliveryResult> {
  const mode = otpDeliveryMode();
  if (mode === "TEST_MODE") return { status: "TEST_MODE", reference: "local-test-channel" };
  if (mode === "ESMS") return deliverWithEsms(input);
  if (mode === "WEBHOOK") return deliverWithWebhook(input);
  throw new Error("OTP_DELIVERY_DISABLED");
}
