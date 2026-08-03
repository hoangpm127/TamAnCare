import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { publicPaymentConfig } from "@/lib/public-payment-config";
import { money, notifyOperations } from "@/lib/server/notification-service";
import {
  confirmIncomingPayment,
  normalizeTransferCode,
  PaymentReconciliationError,
} from "@/lib/server/payment-service";

export const dynamic = "force-dynamic";

const webhookSchema = z.object({
  id: z.union([z.string(), z.number()]),
  gateway: z.string().min(1),
  transactionDate: z.string().min(10),
  accountNumber: z.string().min(1),
  subAccount: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  transferType: z.enum(["in", "out"]),
  description: z.string().nullable().optional(),
  transferAmount: z.coerce.number().int().positive(),
  accumulated: z.coerce.number().optional(),
  referenceCode: z.string().nullable().optional(),
}).passthrough();

function verifySignature(rawBody: string, timestamp: string | null, signatureHeader: string | null) {
  const secret = process.env.SEPAY_WEBHOOK_SECRET;
  if (!secret || !timestamp || !signatureHeader) return false;
  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp)) return false;
  const timestampMs = numericTimestamp > 1_000_000_000_000 ? numericTimestamp : numericTimestamp * 1000;
  if (Math.abs(Date.now() - timestampMs) > 5 * 60_000) return false;

  const providedHex = signatureHeader.replace(/^sha256=/i, "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(providedHex)) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  const provided = Buffer.from(providedHex, "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function configuredAccountMatches(accountNumber: string) {
  const configuredAccounts = (process.env.SEPAY_ACCOUNT_NUMBERS ?? publicPaymentConfig.accountNumber)
    .split(",")
    .map((value) => value.replace(/\D/g, ""))
    .filter(Boolean);
  return configuredAccounts.includes(accountNumber.replace(/\D/g, ""));
}

function sepayPaidAt(value: string) {
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
    ? value
    : `${value.trim().replace(" ", "T")}+07:00`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function successResponse() {
  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  if (!process.env.SEPAY_WEBHOOK_SECRET) {
    console.error("sepay.webhook_secret_missing");
    return NextResponse.json({ success: false }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-sepay-timestamp"), request.headers.get("x-sepay-signature"))) {
    console.warn("sepay.invalid_signature");
    return NextResponse.json({ success: false }, { status: 401 });
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawBody || "null");
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
  const parsed = webhookSchema.safeParse(decoded);
  if (!parsed.success) {
    console.warn("sepay.invalid_payload", parsed.error.flatten());
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const payload = parsed.data;
  const externalEventId = String(payload.id);
  const priorEvent = await db.paymentWebhookEvent.findUnique({
    where: { provider_externalEventId: { provider: "SEPAY", externalEventId } },
    select: { id: true },
  });
  if (priorEvent) return successResponse();

  try {
    await db.$transaction(async (tx) => {
      const event = await tx.paymentWebhookEvent.create({
        data: {
          provider: "SEPAY",
          externalEventId,
          signatureValid: true,
          payload: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,
        },
      });

      if (payload.transferType !== "in") {
        await tx.paymentWebhookEvent.update({
          where: { id: event.id },
          data: { status: "IGNORED_OUTGOING", processedAt: new Date() },
        });
        return;
      }

      if (!configuredAccountMatches(payload.accountNumber)) {
        await tx.paymentWebhookEvent.update({
          where: { id: event.id },
          data: {
            status: "REVIEW",
            errorCode: "ACCOUNT_MISMATCH",
            errorMessage: "Giao dịch đến tài khoản chưa được cấu hình cho Tâm An Care.",
            processedAt: new Date(),
          },
        });
        await notifyOperations(tx, {
          audience: "MANAGEMENT",
          type: "FINANCE",
          title: "Giao dịch ngân hàng cần kiểm tra tài khoản nhận",
          body: `SePay ${externalEventId} · ${money(payload.transferAmount)} chưa được tự động hạch toán.`,
          actionUrl: "/admin/finance",
        });
        return;
      }

      const searchable = normalizeTransferCode([
        payload.code,
        payload.content,
        payload.description,
        payload.referenceCode,
      ].filter(Boolean).join(" "));
      const candidates = await tx.paymentTransaction.findMany({
        where: {
          status: "PENDING",
          direction: "IN",
          paymentCode: { not: null },
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      const payment = candidates.find((candidate) =>
        candidate.paymentCode && searchable.includes(normalizeTransferCode(candidate.paymentCode)),
      );

      if (!payment) {
        await tx.paymentWebhookEvent.update({
          where: { id: event.id },
          data: {
            status: "UNMATCHED",
            errorCode: "PAYMENT_CODE_NOT_FOUND",
            errorMessage: "Không tìm thấy yêu cầu thanh toán đang chờ khớp với nội dung chuyển khoản.",
            processedAt: new Date(),
          },
        });
        await notifyOperations(tx, {
          audience: "MANAGEMENT",
          type: "FINANCE",
          title: "Giao dịch ngân hàng chưa khớp booking",
          body: `SePay ${externalEventId} · ${money(payload.transferAmount)} · cần đối soát thủ công nội dung chuyển khoản.`,
          actionUrl: "/admin/finance",
        });
        return;
      }

      const paidAt = sepayPaidAt(payload.transactionDate);
      if (!paidAt) {
        await tx.paymentWebhookEvent.update({
          where: { id: event.id },
          data: {
            status: "REVIEW",
            paymentTransactionId: payment.id,
            errorCode: "INVALID_TRANSACTION_DATE",
            errorMessage: "Thời gian giao dịch từ nhà cung cấp không hợp lệ.",
            processedAt: new Date(),
          },
        });
        return;
      }

      try {
        await confirmIncomingPayment(tx, payment.id, {
          actualAmount: payload.transferAmount,
          externalReference: `sepay:${externalEventId}`,
          paidAt,
          method: "BANK_TRANSFER_SEPAY",
          bankCode: payload.gateway,
        });
        await tx.paymentWebhookEvent.update({
          where: { id: event.id },
          data: { status: "PROCESSED", paymentTransactionId: payment.id, processedAt: new Date() },
        });
      } catch (error) {
        if (!(error instanceof PaymentReconciliationError)) throw error;
        await tx.paymentWebhookEvent.update({
          where: { id: event.id },
          data: {
            status: "REVIEW",
            paymentTransactionId: payment.id,
            errorCode: error.code,
            errorMessage: error.message,
            processedAt: new Date(),
          },
        });
        await notifyOperations(tx, {
          branchId: payment.branchId,
          audience: "MANAGEMENT",
          type: "FINANCE",
          title: "Giao dịch ngân hàng lệch số tiền",
          body: `${payment.paymentCode} · thực nhận ${money(payload.transferAmount)} · ${error.message}`,
          actionUrl: "/admin/finance",
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return successResponse();
    console.error("sepay.webhook_processing_failed", error);
    return NextResponse.json({ success: false }, { status: 503 });
  }

  return successResponse();
}
