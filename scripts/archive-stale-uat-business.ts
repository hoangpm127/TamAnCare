import { loadEnvConfig } from "@next/env";
import { db } from "../lib/db";

loadEnvConfig(process.cwd());

async function main() {
  if (process.env.APP_ENV !== "uat") throw new Error("Tác vụ này chỉ được phép chạy trên APP_ENV=uat.");
  const candidates = await db.officeEvent.findMany({
    where: {
      status: "READY",
      totalAmount: 0,
      leadTherapistId: null,
      startsAt: { lt: new Date() },
    },
    orderBy: { startsAt: "asc" },
  });
  console.table(candidates.map((item) => ({ eventCode: item.eventCode, companyName: item.companyName, startsAt: item.startsAt.toISOString() })));
  if (!process.argv.includes("--apply")) {
    console.log(`PREVIEW: ${candidates.length} hồ sơ UAT mẫu quá hạn sẽ được chuyển sang CANCELLED.`);
    return;
  }
  if (process.env.UAT_CLEANUP_CONFIRMATION !== "ARCHIVE_STALE_BUSINESS") {
    throw new Error("Thiếu UAT_CLEANUP_CONFIRMATION=ARCHIVE_STALE_BUSINESS.");
  }
  if (!candidates.length) return;
  const owner = await db.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true }, orderBy: { createdAt: "asc" } });
  await db.$transaction(async (tx) => {
    for (const event of candidates) {
      const updated = await tx.officeEvent.update({ where: { id: event.id }, data: { status: "CANCELLED" } });
      await tx.adminAuditLog.create({
        data: {
          actorUserId: owner.id,
          branchId: event.branchId,
          action: "UAT_STALE_BUSINESS_ARCHIVE",
          entityType: "OfficeEvent",
          entityId: event.id,
          before: JSON.parse(JSON.stringify(event)),
          after: JSON.parse(JSON.stringify(updated)),
        },
      });
    }
  });
  console.log(`Đã lưu vết và chuyển ${candidates.length} hồ sơ UAT mẫu quá hạn sang CANCELLED.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
