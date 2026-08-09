import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessAdminSection } from "@/lib/admin-auth";
import { customerPinError } from "@/lib/customer-pin";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getAdminSession } from "@/lib/server/admin-session";
import { isSameOriginMutation } from "@/lib/server/request-security";

const schema = z.object({ pin: z.string().regex(/^\d{4}$/) });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !canAccessAdminSection(session, "customers")) {
    return NextResponse.json({ error: "Không có quyền cấp lại Mã PIN khách hàng." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Mã PIN phải gồm đúng 4 số." }, { status: 400 });
  const { id } = await params;
  const customer = await db.customer.findFirst({
    where: {
      id,
      ...(session.role === "OWNER" ? {} : {
        OR: [
          { bookings: { some: { branchId: session.branchId ?? "__none__" } } },
          { firstSource: { endsWith: `:${session.branchId ?? "__none__"}` } },
        ],
      }),
    },
    include: { account: true },
  });
  if (!customer?.account) return NextResponse.json({ error: "Khách hàng chưa có hồ sơ đăng nhập." }, { status: 404 });
  const pinError = customerPinError(parsed.data.pin, customer.phone);
  if (pinError) return NextResponse.json({ error: pinError }, { status: 400 });
  await db.$transaction([
    db.customerAccount.update({ where: { id: customer.account.id }, data: { pinHash: hashPassword(parsed.data.pin) } }),
    db.customerSession.deleteMany({ where: { customerId: customer.id } }),
    db.adminAuditLog.create({
      data: {
        actorUserId: session.id,
        branchId: session.branchId,
        action: "CUSTOMER_PIN_RESET",
        entityType: "CustomerAccount",
        entityId: customer.account.id,
        after: { customerId: customer.id, sessionsRevoked: true },
      },
    }),
  ]);
  return NextResponse.json({ ok: true, sessionsRevoked: true });
}
