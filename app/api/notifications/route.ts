import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/server/customer-session";
import { getGuestSession } from "@/lib/server/guest-session";
import { isSameOriginMutation } from "@/lib/server/request-security";
import { repairLegacyVisibleText } from "@/lib/server/text-safety";

const updateSchema = z.object({ id: z.string().optional(), all: z.boolean().optional() })
  .refine((value) => value.id || value.all, { message: "Cần chọn thông báo." });

const customerType = {
  BOOKING: "BOOKING",
  PAYMENT: "BOOKING",
  PROMOTION: "PROMO",
  REMINDER: "REMINDER",
  INVITATION: "INVITE",
  FINANCE: "SYSTEM",
  SYSTEM: "SYSTEM",
} as const;

async function notificationCustomerIds() {
  const [account, guest] = await Promise.all([getCustomerSession(), getGuestSession()]);
  if (account) return { customerIds: [account.customerId], authenticated: true };
  if (!guest) return { customerIds: [], authenticated: false };
  const [bookingGrants, businessGrants] = await Promise.all([
    db.bookingAccessGrant.findMany({
      where: { guestSessionId: guest.id, expiresAt: { gt: new Date() } },
      select: { bookingGroup: { select: { customerId: true } }, booking: { select: { customerId: true } } },
    }),
    db.businessAccessGrant.findMany({
      where: { guestSessionId: guest.id, expiresAt: { gt: new Date() } },
      select: { officeEvent: { select: { customerId: true } } },
    }),
  ]);
  return {
    customerIds: [...new Set([
      ...bookingGrants.flatMap((item) => [item.bookingGroup?.customerId, item.booking?.customerId]),
      ...businessGrants.map((item) => item.officeEvent.customerId),
    ].filter((id): id is string => Boolean(id)))],
    authenticated: false,
  };
}

export async function GET() {
  const access = await notificationCustomerIds();
  if (!access.customerIds.length) return NextResponse.json({ notifications: [], authenticated: access.authenticated });
  const notifications = await db.notification.findMany({
    where: { customerId: { in: access.customerIds } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    notifications: notifications.map((item) => ({
      id: item.id,
      type: customerType[item.type],
      title: repairLegacyVisibleText(item.title),
      body: repairLegacyVisibleText(item.body),
      actionUrl: item.actionUrl,
      createdAt: item.createdAt.toISOString(),
      read: Boolean(item.readAt),
    })),
  });
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const access = await notificationCustomerIds();
  if (!access.customerIds.length) return NextResponse.json({ error: "Thiết bị chưa có quyền cập nhật thông báo." }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Thông báo chưa hợp lệ." }, { status: 400 });
  const where = parsed.data.all
    ? { customerId: { in: access.customerIds } }
    : { id: parsed.data.id!, customerId: { in: access.customerIds } };
  const result = await db.notification.updateMany({ where, data: { readAt: new Date() } });
  return NextResponse.json({ persisted: true, updated: result.count });
}
