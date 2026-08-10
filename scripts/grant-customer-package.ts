import { addDays } from "date-fns";
import { db } from "../lib/db";
import { isVietnamMobilePhone, normalizeVietnamPhone } from "../lib/server/phone-otp";

const CONFIRMATION = "GRANT_ACTIVE_CUSTOMER_PACKAGE";

async function main() {
  if (process.env.CONFIRM_PACKAGE_GRANT !== CONFIRMATION) {
    throw new Error(`Thiếu xác nhận CONFIRM_PACKAGE_GRANT=${CONFIRMATION}.`);
  }
  const rawPhone = process.env.GRANT_CUSTOMER_PHONE?.trim() ?? "";
  const planId = process.env.GRANT_PACKAGE_PLAN_ID?.trim() ?? "";
  if (!isVietnamMobilePhone(rawPhone)) throw new Error("Số điện thoại cấp gói chưa hợp lệ.");
  if (!planId) throw new Error("Thiếu GRANT_PACKAGE_PLAN_ID.");

  const phone = normalizeVietnamPhone(rawPhone);
  const [account, plan] = await Promise.all([
    db.customerAccount.findUnique({ where: { phone }, select: { customerId: true } }),
    db.packagePlan.findUnique({ where: { id: planId }, include: { service: { select: { isActive: true, isOnline: true } } } }),
  ]);
  if (!account) throw new Error("Không tìm thấy tài khoản khách hàng.");
  if (!plan || !plan.isActive || (plan.service && (!plan.service.isActive || !plan.service.isOnline))) {
    throw new Error("Gói dịch vụ không tồn tại hoặc không còn hoạt động.");
  }

  const now = new Date();
  const existing = await db.customerPackage.findFirst({
    where: {
      customerId: account.customerId,
      packagePlanId: plan.id,
      status: "ACTIVE",
      expiresAt: { gt: now },
      OR: [{ sessionsRemaining: { gt: 0 } }, { sessionsReserved: { gt: 0 } }],
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    console.log(JSON.stringify({
      success: true,
      idempotent: true,
      packageId: existing.id,
      planId: plan.id,
      planName: plan.name,
      sessionsTotal: existing.sessionsTotal,
      sessionsRemaining: existing.sessionsRemaining,
      sessionsReserved: existing.sessionsReserved,
      status: existing.status,
      expiresAt: existing.expiresAt.toISOString(),
    }, null, 2));
    return;
  }

  const customerPackage = await db.customerPackage.create({
    data: {
      customerId: account.customerId,
      packagePlanId: plan.id,
      sessionsTotal: plan.sessions,
      sessionsRemaining: plan.sessions,
      sessionsReserved: 0,
      expiresAt: addDays(now, plan.validityDays),
      status: "ACTIVE",
      note: "Cấp thủ công phục vụ kiểm thử; không ghi nhận thanh toán hoặc doanh thu.",
    },
  });
  console.log(JSON.stringify({
    success: true,
    idempotent: false,
    packageId: customerPackage.id,
    planId: plan.id,
    planName: plan.name,
    sessionsTotal: customerPackage.sessionsTotal,
    sessionsRemaining: customerPackage.sessionsRemaining,
    sessionsReserved: customerPackage.sessionsReserved,
    status: customerPackage.status,
    expiresAt: customerPackage.expiresAt.toISOString(),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("package.grant_failed", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
