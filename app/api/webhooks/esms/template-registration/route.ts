import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function secureTokenMatches(actual: string | null, expected: string | undefined) {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function textValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function callbackPayload(request: Request) {
  const url = new URL(request.url);
  const payload: Record<string, unknown> = Object.fromEntries(url.searchParams);
  if (request.method !== "POST") return payload;
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    return { ...payload, ...await request.json().catch(() => ({})) };
  }
  const formData = await request.formData().catch(() => null);
  return formData ? { ...payload, ...Object.fromEntries(formData) } : payload;
}

async function handleCallback(request: Request) {
  const url = new URL(request.url);
  if (!secureTokenMatches(url.searchParams.get("token"), process.env.ESMS_CALLBACK_TOKEN?.trim())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await callbackPayload(request);
  const servicePreviewId = textValue(
    payload.ServicePreviewId ?? payload.servicePreviewId ?? payload.ServicepreviewId,
    100,
  );
  const rawStatus = textValue(payload.Status ?? payload.status ?? payload.Result ?? payload.result, 30);
  const providerMessage = textValue(payload.ErrorMessage ?? payload.errorMessage ?? payload.Message ?? payload.message, 300);
  const status = rawStatus === "2" ? "APPROVED" : rawStatus === "1" ? "PENDING" : rawStatus === "0" ? "REJECTED" : "UNKNOWN";

  await db.systemSetting.upsert({
    where: { scopeKey: "global:ESMS_TEMPLATE_REGISTRATION_STATUS" },
    create: {
      key: "ESMS_TEMPLATE_REGISTRATION_STATUS",
      scopeKey: "global:ESMS_TEMPLATE_REGISTRATION_STATUS",
      category: "INTEGRATION",
      label: "Trạng thái duyệt mẫu OTP eSMS",
      value: JSON.stringify({ status, rawStatus, servicePreviewId, providerMessage, receivedAt: new Date().toISOString() }),
      valueType: "JSON",
      description: "Callback từ eSMS cho yêu cầu đăng ký mẫu OTP đầu số cố định.",
    },
    update: {
      value: JSON.stringify({ status, rawStatus, servicePreviewId, providerMessage, receivedAt: new Date().toISOString() }),
      isActive: true,
    },
  });

  return NextResponse.json({ received: true, status });
}

export async function GET(request: Request) {
  return handleCallback(request);
}

export async function POST(request: Request) {
  return handleCallback(request);
}
