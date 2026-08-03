import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

export const MAX_EXPENSE_EVIDENCE_BYTES = 5 * 1024 * 1024;

export const EXPENSE_CATEGORY_LABELS = [
  "Cơ sở vật chất",
  "Khấu hao tài sản",
  "Lương nhân sự",
  "Thưởng & hoa hồng",
  "Mặt bằng",
  "Điện, nước & Internet",
  "Vật tư tiêu hao",
  "Marketing & bán hàng",
  "Bảo trì thiết bị",
  "Nền tảng & hệ thống",
  "Thuế, phí & hành chính",
  "Chi phí khác",
] as const;

const aiExtractionSchema = z.object({
  documentType: z.enum(["RECEIPT", "VAT_INVOICE", "TRANSFER", "OTHER"]),
  amount: z.number().int().nonnegative().nullable(),
  vendor: z.string().trim().max(200).nullable(),
  transactionDate: z.string().trim().max(10).nullable(),
  category: z.enum(EXPENSE_CATEGORY_LABELS).nullable(),
  confidence: z.number().int().min(0).max(100),
  note: z.string().trim().max(300).nullable(),
});

type OpenAIResponse = {
  id?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

export type ExpenseEvidenceExtraction = z.infer<typeof aiExtractionSchema> & {
  model: string;
  responseId: string | null;
};

export function sanitizeEvidenceFileName(value: string) {
  const baseName = value.split(/[\\/]/).pop() ?? "bill";
  const sanitized = baseName.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (sanitized || "bill").slice(0, 160);
}

export function sha256Hex(data: Uint8Array) {
  return createHash("sha256").update(data).digest("hex");
}

export function detectSupportedImageMime(data: Uint8Array) {
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
    && data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a) return "image/png";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.length >= 12
    && String.fromCharCode(...data.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...data.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

function outputText(response: OpenAIResponse) {
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return null;
}

export async function extractExpenseEvidence(
  data: Uint8Array,
  mimeType: string,
  safetyIdentifier: string,
): Promise<ExpenseEvidenceExtraction | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_EXPENSE_MODEL?.trim() || "gpt-5.6-luna";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        store: false,
        safety_identifier: safetyIdentifier,
        reasoning: { effort: "low" },
        max_output_tokens: 700,
        instructions: [
          "Bạn trích xuất dữ liệu từ chứng từ chi phí bằng tiếng Việt.",
          "Chỉ dùng thông tin nhìn thấy rõ trong ảnh, tuyệt đối không đoán hay tự tạo dữ liệu.",
          "amount là tổng tiền cuối cùng bằng VND, dạng số nguyên; không có thì trả null.",
          "transactionDate theo YYYY-MM-DD; không chắc thì trả null.",
          "category phải là một lựa chọn được cung cấp; không chắc thì trả null.",
          "confidence phản ánh độ chắc chắn tổng thể của việc đọc chứng từ, từ 0 đến 100.",
        ].join(" "),
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: `Đọc chứng từ này. Danh mục hợp lệ: ${EXPENSE_CATEGORY_LABELS.join("; ")}.` },
            { type: "input_image", image_url: `data:${mimeType};base64,${Buffer.from(data).toString("base64")}`, detail: "high" },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "expense_receipt",
            strict: true,
            schema: {
              type: "object",
              properties: {
                documentType: { type: "string", enum: ["RECEIPT", "VAT_INVOICE", "TRANSFER", "OTHER"] },
                amount: { type: ["integer", "null"], minimum: 0 },
                vendor: { type: ["string", "null"] },
                transactionDate: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                category: { type: ["string", "null"], enum: [...EXPENSE_CATEGORY_LABELS, null] },
                confidence: { type: "integer", minimum: 0, maximum: 100 },
                note: { type: ["string", "null"] },
              },
              required: ["documentType", "amount", "vendor", "transactionDate", "category", "confidence", "note"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    if (!response.ok) throw new Error(`OpenAI expense extraction failed with ${response.status}.`);
    const payload = await response.json() as OpenAIResponse;
    const text = outputText(payload);
    if (!text) throw new Error("OpenAI expense extraction returned no text.");
    const parsed = aiExtractionSchema.parse(JSON.parse(text));
    return { ...parsed, model, responseId: payload.id ?? null };
  } finally {
    clearTimeout(timeout);
  }
}

export function extractionDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
