import "server-only";

import { db } from "@/lib/db";

export type VoucherInventoryItem = {
  code: string;
  used: number;
  total: number | null;
  remaining: number | null;
};

export async function getVoucherInventory() {
  const now = new Date();
  const activeVouchers = await db.voucher.findMany({
    where: {
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        { OR: [{ serviceId: null }, { service: { is: { isActive: true, isOnline: true } } }] },
      ],
    },
    select: { id: true, code: true, maxUsage: true },
    orderBy: { createdAt: "asc" },
  });

  const items = await Promise.all(activeVouchers.map(async (voucher) => {
    const used = await db.voucherUsage.count({
      where: {
        voucherId: voucher.id,
        OR: [
          { status: "CONFIRMED" },
          { status: "RESERVED", expiresAt: { gt: now } },
        ],
      },
    });
    return {
      code: voucher.code,
      used,
      total: voucher.maxUsage,
      remaining: voucher.maxUsage === null ? null : Math.max(0, voucher.maxUsage - used),
    } satisfies VoucherInventoryItem;
  }));

  return Object.fromEntries(items.map((item) => [item.code, item]));
}
