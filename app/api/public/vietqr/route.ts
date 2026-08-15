import { z } from "zod";
import { buildVietQrImageUrl } from "@/lib/vietqr";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  amount: z.coerce.number().int().positive().max(50_000_000),
  content: z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9._-]+$/),
  purpose: z.enum(["general", "package"]).default("general"),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    amount: url.searchParams.get("amount"),
    content: url.searchParams.get("content"),
    purpose: url.searchParams.get("purpose") ?? "general",
  });
  if (!parsed.success) return Response.json({ error: "Thông tin VietQR chưa hợp lệ." }, { status: 400 });

  try {
    const response = await fetch(buildVietQrImageUrl(parsed.data.amount, parsed.data.content, parsed.data.purpose), {
      headers: { Accept: "image/png,image/*" },
      signal: AbortSignal.timeout(8_000),
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.startsWith("image/")) throw new Error(`VietQR returned ${response.status}`);

    return new Response(await response.arrayBuffer(), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="TamAnCare-${parsed.data.content}.png"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("vietqr.image_download_failed", error);
    return Response.json({ error: "Chưa thể tải mã QR. Vui lòng thử lại." }, { status: 502 });
  }
}
