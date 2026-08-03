import { addDays, addHours, subMinutes } from "date-fns";
import { db } from "../lib/db";

const specs = [
  { code: "CMC-LUNCH-RESET", branchId: "cs1", companyName: "CMC Tower", location: "Duy Tân, Cầu Giấy, Hà Nội", headcount: 28, completed: false },
  { code: "FPT-LUNCH-RESET", branchId: "cs2", companyName: "FPT Cầu Giấy", location: "Phạm Văn Bạch, Cầu Giấy, Hà Nội", headcount: 18, completed: true },
];

function assert<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}

async function main() {
  const customer = assert(await db.customer.findFirst({ orderBy: { createdAt: "asc" } }), "CSDL chưa có khách demo.");
  for (const [index, spec] of specs.entries()) {
    const previous = await db.officeEvent.findUnique({
      where: { eventCode: spec.code },
      include: { payments: { select: { id: true } }, ledgerEntries: true },
    });
    if (!spec.completed && previous) {
      const paymentIds = previous.payments.map((payment) => payment.id);
      const hadRecognizedRevenue = previous.ledgerEntries.some((entry) => entry.category === "SERVICE_REVENUE");
      await db.$transaction(async (tx) => {
        await tx.notification.deleteMany({ where: { actionUrl: { contains: spec.code } } });
        await tx.paymentWebhookEvent.deleteMany({ where: { paymentTransactionId: { in: paymentIds } } });
        await tx.paymentAccessGrant.deleteMany({ where: { paymentTransactionId: { in: paymentIds } } });
        await tx.tipPayout.deleteMany({ where: { officeEventId: previous.id } });
        await tx.ledgerEntry.deleteMany({ where: { officeEventId: previous.id } });
        await tx.paymentTransaction.deleteMany({ where: { officeEventId: previous.id } });
        if (hadRecognizedRevenue && previous.customerId) {
          const current = await tx.customer.findUnique({ where: { id: previous.customerId }, select: { totalSpend: true, totalVisits: true } });
          if (current) {
            await tx.customer.update({
              where: { id: previous.customerId },
              data: {
                totalSpend: Math.max(0, current.totalSpend - previous.totalAmount),
                totalVisits: Math.max(0, current.totalVisits - 1),
              },
            });
          }
        }
      });
    }
    const therapist = assert(await db.therapist.findFirst({ where: { branchId: spec.branchId, status: "ACTIVE" }, orderBy: { ratingAvg: "desc" } }), `CSDL chưa có KTV tại ${spec.branchId}.`);
    const requiredTherapists = Math.max(2, Math.ceil(spec.headcount / 4));
    const subtotalAmount = spec.headcount * 95_000;
    const transportFee = requiredTherapists * 50_000;
    const totalAmount = subtotalAmount + transportFee;
    const depositAmount = Math.round(totalAmount * 0.1);
    const startsAt = spec.completed ? subMinutes(new Date(), 140) : addDays(new Date(), index + 2);
    const endsAt = addHours(startsAt, 2);
    const event = await db.officeEvent.upsert({
      where: { eventCode: spec.code },
      create: {
        branchId: spec.branchId, customerId: customer.id, leadTherapistId: therapist.id, eventCode: spec.code, companyName: spec.companyName,
        contactName: customer.fullName, contactPhone: customer.phone, taxCode: `0100${index + 1}8888`, location: spec.location,
        serviceLabel: "Chăm sóc cổ vai gáy tiêu chuẩn 20 phút", packageTier: "Sức khỏe định kỳ cho cả công ty",
        headcount: spec.headcount, durationMin: 20, requiredTherapists, sessionsTotal: 8, sessionsUsed: spec.completed ? 1 : 0,
        startsAt, endsAt, actualStartedAt: spec.completed ? startsAt : null, expectedEndAt: spec.completed ? endsAt : null, actualEndedAt: spec.completed ? endsAt : null, completedAt: spec.completed ? endsAt : null,
        subtotalAmount, transportFee, totalAmount, depositAmount, paidAmount: spec.completed ? totalAmount : depositAmount,
        paymentStatus: spec.completed ? "PAID" : "DEPOSITED", status: spec.completed ? "COMPLETED" : "READY", customerRating: spec.completed ? 5 : null,
        customerComment: spec.completed ? "Đội ngũ đúng giờ, điều phối gọn và nhân sự rất hài lòng." : null, reviewedAt: spec.completed ? endsAt : null,
      },
      update: {
        branchId: spec.branchId, customerId: customer.id, leadTherapistId: therapist.id, companyName: spec.companyName,
        contactName: customer.fullName, contactPhone: customer.phone, location: spec.location, serviceLabel: "Chăm sóc cổ vai gáy tiêu chuẩn 20 phút",
        packageTier: "Sức khỏe định kỳ cho cả công ty", headcount: spec.headcount, durationMin: 20, requiredTherapists,
        startsAt, endsAt, actualStartedAt: spec.completed ? startsAt : null, expectedEndAt: spec.completed ? endsAt : null, actualEndedAt: spec.completed ? endsAt : null,
        completedAt: spec.completed ? endsAt : null, endReminderSentAt: null, subtotalAmount, transportFee, totalAmount, depositAmount, paidAmount: spec.completed ? totalAmount : depositAmount,
        paymentStatus: spec.completed ? "PAID" : "DEPOSITED", status: spec.completed ? "COMPLETED" : "READY", sessionsUsed: spec.completed ? 1 : 0,
        customerRating: spec.completed ? 5 : null, customerComment: spec.completed ? "Đội ngũ đúng giờ, điều phối gọn và nhân sự rất hài lòng." : null, reviewedAt: spec.completed ? endsAt : null,
      },
    });
    const registration = await db.officeRegistration.findFirst({ where: { eventId: event.id, customerId: customer.id } });
    if (!registration) await db.officeRegistration.create({ data: { eventId: event.id, customerId: customer.id, fullName: customer.fullName, phone: customer.phone, slotTime: startsAt, status: spec.completed ? "CHECKED_IN" : "REGISTERED" } });
    else await db.officeRegistration.update({ where: { id: registration.id }, data: { slotTime: startsAt, status: spec.completed ? "CHECKED_IN" : "REGISTERED" } });
    const deposit = await db.paymentTransaction.upsert({
      where: { idempotencyKey: `business-deposit:${spec.code}` },
      create: { officeEventId: event.id, branchId: spec.branchId, customerId: customer.id, type: "DEPOSIT", direction: "IN", status: "CONFIRMED", amount: depositAmount, receivedAmount: depositAmount, method: "BANK_TRANSFER_SEPAY", bankCode: "TCB", paymentCode: `TACD${spec.code.replace(/[^A-Z0-9]/g, "").slice(-14)}`, externalReference: `DEMO-BUSINESS-DEPOSIT-${spec.code}`, idempotencyKey: `business-deposit:${spec.code}`, note: `Đặt cọc Tâm An Business · ${spec.companyName}`, paidAt: subMinutes(startsAt, 24 * 60) },
      update: { officeEventId: event.id, amount: depositAmount, receivedAmount: depositAmount, status: "CONFIRMED" },
    });
    const depositLedger = await db.ledgerEntry.findFirst({ where: { officeEventId: event.id, paymentTransactionId: deposit.id, category: "CUSTOMER_DEPOSIT" } });
    if (!depositLedger) await db.ledgerEntry.create({ data: { branchId: spec.branchId, customerId: customer.id, officeEventId: event.id, paymentTransactionId: deposit.id, category: "CUSTOMER_DEPOSIT", dataOrigin: "DEMO", direction: "IN", amount: depositAmount, description: `Tiền cọc Business · ${spec.companyName}`, occurredAt: deposit.paidAt ?? startsAt } });
    if (spec.completed) {
      const balanceAmount = totalAmount - depositAmount;
      const balance = await db.paymentTransaction.upsert({
        where: { idempotencyKey: `business-balance:${spec.code}` },
        create: { officeEventId: event.id, branchId: spec.branchId, customerId: customer.id, type: "SERVICE_PAYMENT", direction: "IN", status: "CONFIRMED", amount: balanceAmount, receivedAmount: balanceAmount, method: "BANK_TRANSFER_SEPAY", bankCode: "TCB", paymentCode: `TACS${spec.code.replace(/[^A-Z0-9]/g, "").slice(-14)}`, externalReference: `DEMO-BUSINESS-BALANCE-${spec.code}`, idempotencyKey: `business-balance:${spec.code}`, note: "Thanh toán phần còn lại Tâm An Business", paidAt: endsAt },
        update: { officeEventId: event.id, amount: balanceAmount, receivedAmount: balanceAmount, status: "CONFIRMED", paidAt: endsAt },
      });
      const revenue = await db.ledgerEntry.findFirst({ where: { officeEventId: event.id, category: "SERVICE_REVENUE" } });
      if (!revenue) await db.ledgerEntry.create({ data: { branchId: spec.branchId, customerId: customer.id, officeEventId: event.id, paymentTransactionId: balance.id, category: "SERVICE_REVENUE", dataOrigin: "DEMO", direction: "IN", amount: totalAmount, description: `Doanh thu Tâm An Business · ${spec.code}`, occurredAt: endsAt } });
    }
    console.log(`${spec.code}: ${spec.completed ? "COMPLETED" : "READY"} · ${totalAmount.toLocaleString("vi-VN")}đ · ${therapist.fullName}`);
  }
}

main().finally(() => db.$disconnect());
