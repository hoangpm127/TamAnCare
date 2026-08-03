import { z } from "zod";
import type { VietQrBankApp } from "@/lib/vietqr";

export const dynamic = "force-dynamic";

const bankAppSchema = z.object({
  appId: z.string().min(1),
  appLogo: z.string(),
  appName: z.string().min(1),
  bankName: z.string().min(1),
  deeplink: z.string().url(),
  autofill: z.number().optional(),
});

const responseSchema = z.object({
  apps: z.array(bankAppSchema),
});

export async function GET(request: Request) {
  const platform = new URL(request.url).searchParams.get("platform") === "ios" ? "ios" : "android";

  try {
    const response = await fetch(`https://api.vietqr.io/v2/${platform}-app-deeplinks`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`VietQR returned ${response.status}`);

    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.apps.length === 0) throw new Error("VietQR bank app list is empty");

    const apps: VietQrBankApp[] = parsed.data.apps;
    return Response.json({ apps }, {
      headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    console.error("vietqr.bank_apps_unavailable", error);
    return Response.json({ apps: [] }, { status: 502 });
  }
}
