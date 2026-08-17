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
  if (!input.therapistName || !input.branchId) return null;
  const therapist = await client.therapist.findFirst({
    where: { branchId: input.branchId, fullName: input.therapistName },
    select: { id: true },
  });
  const therapistUser = await client.user.findFirst({
    where: {
      role: "THERAPIST",
      branchId: input.branchId,
      isActive: true,
      OR: [
        ...(therapist ? [{ therapistId: therapist.id }] : []),
        { name: input.therapistName },
      ],
    },
    select: { id: true },
  });
  if (!therapistUser) return null;
  return client.notification.create({
    data: {
      userId: therapistUser.id,
      branchId: input.branchId,
      type: input.type,
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl,
    },
  });
}

export function money(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value) + "đ";
}
