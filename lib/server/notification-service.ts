import "server-only";

import type { NotificationType, Prisma } from "@/app/generated/prisma/client";

type NotificationClient = Pick<Prisma.TransactionClient, "notification" | "user" | "therapist">;

type NotificationPayload = {
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string;
  branchId?: string | null;
};

type OperationsAudience = "MANAGEMENT" | "OPERATIONS";

export async function notifyCustomer(
  client: NotificationClient,
  customerId: string,
  payload: NotificationPayload,
) {
  return client.notification.create({
    data: {
      customerId,
      branchId: payload.branchId ?? undefined,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      actionUrl: payload.actionUrl,
    },
  });
}

export async function notifyOperations(
  client: NotificationClient,
  payload: NotificationPayload & { audience?: OperationsAudience },
) {
  const branchRoles = payload.audience === "MANAGEMENT" ? ["MANAGER"] as const : ["MANAGER", "RECEPTIONIST"] as const;
  const recipients = await client.user.findMany({
    where: {
      OR: [
        { role: "OWNER" },
        ...(payload.branchId
          ? [{ branchId: payload.branchId, role: { in: [...branchRoles] } }]
          : []),
      ],
    },
    select: { id: true },
  });

  if (!recipients.length) return [];
  await client.notification.createMany({
    data: recipients.map((recipient) => ({
      userId: recipient.id,
      branchId: payload.branchId ?? undefined,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      actionUrl: payload.actionUrl,
    })),
  });
  return recipients;
}

export async function notifyTherapist(
  client: NotificationClient,
  input: NotificationPayload & { therapistName?: string | null },
) {
  // KTV là dữ liệu nhân sự do Lễ tân/Admin điều phối, không còn tài khoản CNTT.
  // Giữ hàm no-op để các luồng nghiệp vụ cũ không phải tạo thông báo mồ côi.
  void client;
  void input;
  return null;
}

export function money(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value) + "đ";
}
