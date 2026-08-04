import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/server/admin-session";
import { bookingGroupToDto, bookingToDto } from "@/lib/server/booking-dal";
import { reportsIncludeDemoLedger, summarizeLedgerOrigins } from "@/lib/server/ledger-reporting";

function defaultRange() {
  const formatted = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date());
  const [year, month] = formatted.split("-").map(Number);
  return {
    start: new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+07:00`),
    end: new Date(`${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}T23:59:59+07:00`),
  };
}

function isInDayPart(date: Date, dayPart: string) {
  if (dayPart === "all") return true;
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    hour12: false,
  }).format(date)) % 24;
  if (dayPart === "morning") return hour < 12;
  if (dayPart === "afternoon") return hour >= 12 && hour < 18;
  if (dayPart === "evening") return hour >= 18;
  return true;
}

export async function GET(request: Request) {
  const session = await requireAdminSession(["OWNER", "BRANCH_MANAGER"]);
  if (!session) return NextResponse.json({ error: "Bạn không có quyền xem tài chính." }, { status: 401 });
  const url = new URL(request.url);
  const fallback = defaultRange();
  const start = url.searchParams.get("from") ? new Date(`${url.searchParams.get("from")}T00:00:00+07:00`) : fallback.start;
  const end = url.searchParams.get("to") ? new Date(`${url.searchParams.get("to")}T23:59:59+07:00`) : fallback.end;
  const requestedBranch = url.searchParams.get("branchId");
  const branchId = session.role === "OWNER" ? (requestedBranch && requestedBranch !== "all" ? requestedBranch : undefined) : session.branchId ?? undefined;
  const dayPart = url.searchParams.get("dayPart") ?? "all";
  const timeWhere = { gte: start, lte: end };

  // Chạy tuần tự để tương thích cả PostgreSQL managed và PGlite socket dùng cho UAT local.
  // Một số adapter PostgreSQL giả lập chỉ cho một query hoạt động trên mỗi client.
  const rawEntries = await db.ledgerEntry.findMany({ where: { ...(branchId ? { branchId } : {}), occurredAt: timeWhere }, orderBy: { occurredAt: "desc" } });
  const rawPayments = await db.paymentTransaction.findMany({ where: { ...(branchId ? { branchId } : {}), status: "CONFIRMED", paidAt: timeWhere }, orderBy: { paidAt: "desc" } });
  const rawGroups = await db.bookingGroup.findMany({
      where: { ...(branchId ? { branchId } : {}), createdAt: timeWhere },
      include: {
        branch: true,
        customer: true,
        payments: { orderBy: { createdAt: "desc" } },
        bookings: {
          include: { service: true, therapist: true, room: true, customerPackage: { include: { packagePlan: true } } },
          orderBy: { startTime: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  const rawDirectBookings = await db.booking.findMany({
      where: { ...(branchId ? { branchId } : {}), groupId: null, startTime: timeWhere },
      include: { branch: true, customer: true, service: true, therapist: true, room: true },
      orderBy: { startTime: "desc" },
    });
  const rawExpenses = await db.expense.findMany({ where: { ...(branchId ? { branchId } : {}), occurredAt: timeWhere }, orderBy: { occurredAt: "desc" } });
  const rawTips = await db.tipPayout.findMany({ where: { ...(branchId ? { branchId } : {}), serviceDate: timeWhere }, include: { therapist: true, booking: true, officeEvent: true }, orderBy: { serviceDate: "desc" } });
  const branchRecords = await db.branch.findMany({ where: branchId ? { id: branchId } : {}, orderBy: { id: "asc" } });

  const originScopedEntries = rawEntries.filter((item) => isInDayPart(item.occurredAt, dayPart));
  const dataQuality = summarizeLedgerOrigins(originScopedEntries);
  const entries = reportsIncludeDemoLedger()
    ? originScopedEntries
    : originScopedEntries.filter((item) => item.dataOrigin !== "DEMO");
  const payments = rawPayments.filter((item) => item.paidAt && isInDayPart(item.paidAt, dayPart));
  const groups = rawGroups.filter((item) => isInDayPart(item.bookings[0]?.startTime ?? item.createdAt, dayPart));
  const directBookings = rawDirectBookings.filter((item) => isInDayPart(item.startTime, dayPart));
  const expenses = rawExpenses.filter((item) => isInDayPart(item.occurredAt, dayPart));
  const tips = rawTips.filter((item) => isInDayPart(item.serviceDate, dayPart));

  const sumCategory = (category: string) => entries.filter((item) => item.category === category).reduce((sum, item) => sum + item.amount, 0);
  const serviceRevenue = sumCategory("SERVICE_REVENUE");
  const refunds = sumCategory("REFUND");
  const netServiceRevenue = serviceRevenue - refunds;
  const operatingExpenses = sumCategory("OPERATING_EXPENSE");
  const platformFees = sumCategory("PLATFORM_FEE");
  const totalExpenses = operatingExpenses + platformFees;
  const tipAmount = sumCategory("TIP_PAYABLE");
  const cashIn = payments.filter((item) => item.direction === "IN").reduce((sum, item) => sum + item.amount, 0);
  const cashOut = payments.filter((item) => item.direction === "OUT").reduce((sum, item) => sum + item.amount, 0);
  const deposits = payments.filter((item) => item.type === "DEPOSIT").reduce((sum, item) => sum + item.amount, 0);

  const branchBreakdown = branchRecords.map((branch) => {
    const scoped = entries.filter((item) => item.branchId === branch.id);
    const revenue = scoped.filter((item) => item.category === "SERVICE_REVENUE").reduce((sum, item) => sum + item.amount, 0);
    const branchRefunds = scoped.filter((item) => item.category === "REFUND").reduce((sum, item) => sum + item.amount, 0);
    const netRevenue = revenue - branchRefunds;
    const branchOperatingExpenses = scoped.filter((item) => item.category === "OPERATING_EXPENSE").reduce((sum, item) => sum + item.amount, 0);
    const branchPlatformFees = scoped.filter((item) => item.category === "PLATFORM_FEE").reduce((sum, item) => sum + item.amount, 0);
    const branchExpenses = branchOperatingExpenses + branchPlatformFees;
    const branchTips = scoped.filter((item) => item.category === "TIP_PAYABLE").reduce((sum, item) => sum + item.amount, 0);
    return { branchId: branch.id, label: branch.name.replace(/^Tâm An Center · /, ""), grossRevenue: revenue, refunds: branchRefunds, revenue: netRevenue, partnerRevenue: Math.max(0, netRevenue - branchPlatformFees), operatingExpenses: branchOperatingExpenses, platformFees: branchPlatformFees, expenses: branchExpenses, tips: branchTips, profit: netRevenue - branchExpenses };
  });

  const platformFeeItems = entries
    .filter((item) => item.category === "PLATFORM_FEE")
    .map((item) => ({
      id: item.id,
      branchId: item.branchId,
      category: "Phí nền tảng Xgroup",
      description: item.description,
      amount: item.amount,
      vendor: "Xgroup · Nền tảng Tâm An Center",
      evidenceUrl: null,
      occurredAt: item.occurredAt,
    }));

  return NextResponse.json({
    period: { start: start.toISOString(), end: end.toISOString() },
    dataQuality,
    grossServiceRevenue: serviceRevenue,
    refunds,
    serviceRevenue: netServiceRevenue,
    cashIn,
    cashOut,
    deposits,
    platformRevenue: platformFees,
    partnerRevenue: Math.max(0, netServiceRevenue - platformFees),
    operatingExpenses,
    platformFees,
    expenses: totalExpenses,
    tips: tipAmount,
    profit: netServiceRevenue - totalExpenses,
    branchBreakdown,
    bills: [...groups.map(bookingGroupToDto), ...directBookings.map(bookingToDto)].sort((a, b) => new Date(b.timeIso).getTime() - new Date(a.timeIso).getTime()),
    expenseItems: [...expenses, ...platformFeeItems].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
    tipPayouts: tips.map((item) => ({
      id: item.id,
      bookingCode: item.booking?.bookingCode ?? item.officeEvent?.eventCode ?? "Tâm An Business",
      therapistName: item.therapist?.fullName ?? "Chờ phân công",
      branchId: item.branchId,
      amount: item.amount,
      status: item.status,
      dueAt: item.dueAt.toISOString(),
      paidAt: item.paidAt?.toISOString(),
    })),
    ledger: entries,
  });
}
