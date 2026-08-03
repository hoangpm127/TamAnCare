import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";

export async function notifyInvestorsAboutOpportunity(
  tx: Prisma.TransactionClient,
  opportunity: { name: string; area: string },
) {
  const investors = await tx.user.findMany({ where: { role: "INVESTOR", isActive: true }, select: { id: true } });
  if (!investors.length) return;
  await tx.notification.createMany({
    data: investors.map((investor) => ({
      userId: investor.id,
      type: "FINANCE" as const,
      title: "Cơ hội đầu tư mới từ Tâm An Center",
      body: `${opportunity.name} · ${opportunity.area}. Hồ sơ đang được cập nhật tại Trung tâm Nhà đầu tư.`,
      actionUrl: "/admin#opportunities",
    })),
  });
}
