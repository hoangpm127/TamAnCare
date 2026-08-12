import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { CUSTOMER_LANGUAGES } from "@/lib/customer-i18n";
import { getCustomerSession } from "@/lib/server/customer-session";
import { isSameOriginMutation } from "@/lib/server/request-security";

const schema = z.object({ language: z.enum(CUSTOMER_LANGUAGES) });

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Yêu cầu cập nhật ngôn ngữ không hợp lệ." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ngôn ngữ chưa được hỗ trợ." }, { status: 400 });
  }
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ saved: false, authenticated: false });
  if (session.preferredLanguage !== parsed.data.language) {
    await db.customerAccount.update({
      where: { customerId: session.customerId },
      data: { preferredLanguage: parsed.data.language },
    });
  }
  return NextResponse.json({ saved: true, authenticated: true });
}
