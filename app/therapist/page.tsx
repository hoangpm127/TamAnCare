import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { bookingStatusLabel } from "@/lib/labels";
import { getAdminSession } from "@/lib/server/admin-session";
import { therapistForSession } from "@/lib/server/therapist-session";
import { TherapistCalendarSchedule } from "@/components/therapist-weekly-schedule";

export const dynamic = "force-dynamic";

const BUSINESS_STATUS: Record<string, string> = {
  AWAITING_DEPOSIT: "Chờ cọc",
  DEPOSIT_CONFIRMED: "Chờ phân công",
  READY: "Sẵn sàng",
  IN_SERVICE: "Đang phục vụ",
  AWAITING_BALANCE: "Chờ thanh toán",
  COMPLETED: "Hoàn tất",
};

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function startOfVietnamDay(value: Date) {
  return new Date(`${dayKey(value)}T00:00:00+07:00`);
}

function mondayOfWeek(value: Date) {
  const start = startOfVietnamDay(value);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(start);
  const index = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
  return new Date(start.getTime() - Math.max(0, index) * 24 * 60 * 60_000);
}

function relationshipLabel(value: string) {
  if (value === "FRIEND") return "Rủ bạn";
  if (value === "BOSS") return "Mời sếp";
  return "Cá nhân";
}

function regularAdvice(input: { relationship: string; serviceName: string; durationMin: number; requestNote: string }) {
  const advice = [`Chuẩn bị đúng quy trình ${input.serviceName}; kiểm tra lại lực tay và vùng khách cần ưu tiên trước khi bắt đầu.`];
  if (input.relationship === "BOSS") advice.push("Giữ tác phong trang trọng, xưng hô tinh tế và phối hợp quầy để nhóm được phục vụ gần nhau.");
  else if (input.relationship === "FRIEND") advice.push("Chủ động phối hợp giường gần nhau, đồng bộ thời điểm bắt đầu và kết thúc để nhóm không phải chờ.");
  else advice.push("Xác nhận lại mức lực tay, nhiệt độ phòng và vùng cần tránh để cá nhân hóa trải nghiệm.");
  if (input.requestNote !== "Không có yêu cầu riêng.") advice.push(`Nhắc lại với khách trước ca: ${input.requestNote}`);
  if (input.durationMin >= 90) advice.push("Ca dài: chuẩn bị nước ấm và dành một nhịp kiểm tra cảm nhận của khách ở giữa liệu trình.");
  return advice.slice(0, 4);
}

function businessAdvice(input: { companyName: string; headcount: number; location: string }) {
  return [
    `Có mặt sớm tối thiểu 20 phút tại ${input.location} để kiểm tra khu vực triển khai và lối di chuyển.`,
    `Đối chiếu danh sách ${input.headcount} nhân sự, phân luồng theo thứ tự và giữ nhịp phục vụ đồng đều.`,
    `KTV trưởng xác nhận bắt đầu/kết thúc bằng QR, ghi nhận phát sinh và báo cáo ngay cho điều phối ${input.companyName}.`,
  ];
}

export default async function TherapistSchedulePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || session.role !== "THERAPIST") redirect("/dang-nhap-quan-tri");
  const therapist = await therapistForSession(session);
  if (!therapist) return <div className="mx-auto max-w-lg p-6 text-center"><p className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">Tài khoản chưa được liên kết hồ sơ KTV. Vui lòng báo Quản lý cơ sở kiểm tra mục Kỹ thuật viên.</p></div>;

  const currentMonth = dayKey(new Date()).slice(0, 7);
  const requestedMonth = (await searchParams).month;
  const monthKey = requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : currentMonth;
  const monthStart = new Date(`${monthKey}-01T00:00:00+07:00`);
  const safeMonthStart = Number.isNaN(monthStart.getTime()) ? new Date(`${currentMonth}-01T00:00:00+07:00`) : monthStart;
  const [year, month] = dayKey(safeMonthStart).slice(0, 7).split("-").map(Number);
  const nextMonthStart = new Date(`${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01T00:00:00+07:00`);
  const calendarStart = mondayOfWeek(safeMonthStart);
  const lastDay = new Date(nextMonthStart.getTime() - 24 * 60 * 60_000);
  const lastWeekStart = mondayOfWeek(lastDay);
  const calendarEnd = new Date(lastWeekStart.getTime() + 7 * 24 * 60 * 60_000);
  const todayKey = dayKey(new Date());
  const days = Array.from({ length: Math.round((calendarEnd.getTime() - calendarStart.getTime()) / (24 * 60 * 60_000)) }, (_, index) => {
    const date = new Date(calendarStart.getTime() + index * 24 * 60 * 60_000);
    const key = dayKey(date);
    return { key, dayNumber: new Intl.DateTimeFormat("vi-VN", { day: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(date), fullLabel: new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(date), isToday: key === todayKey, isCurrentMonth: key.startsWith(dayKey(safeMonthStart).slice(0, 7)) };
  });

  const [bookings, businessEvents] = await Promise.all([
    db.booking.findMany({
      where: { therapistId: therapist.id, startTime: { gte: calendarStart, lt: calendarEnd }, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      include: { customer: true, service: true, room: true, group: true },
      orderBy: { startTime: "asc" },
    }),
    db.officeEvent.findMany({
      where: { leadTherapistId: therapist.id, startsAt: { gte: calendarStart, lt: calendarEnd }, status: { not: "CANCELLED" } },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const regular = bookings.map((booking) => {
    const relationship: "SELF" | "FRIEND" | "BOSS" = booking.group?.relationship === "FRIEND" || booking.group?.relationship === "BOSS" ? booking.group.relationship : "SELF";
    const requestNote = booking.group?.careNote?.trim() || booking.note?.replace(/^\[[^\]]+\]\s*/g, "").trim() || "Không có yêu cầu riêng.";
    return {
      id: booking.id,
      bookingCode: booking.bookingCode,
      dayKey: dayKey(booking.startTime),
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      customerName: booking.customer.fullName,
      serviceName: booking.service.name,
      roomName: booking.room?.name ?? "Chờ xếp giường",
      relationship,
      relationshipLabel: relationshipLabel(relationship),
      requestNote,
      statusLabel: bookingStatusLabel(booking.status),
      aiAdvice: regularAdvice({ relationship, serviceName: booking.service.name, durationMin: booking.durationMin, requestNote }),
    };
  });
  const business = businessEvents.map((event) => ({
    id: event.id,
    eventCode: event.eventCode,
    dayKey: dayKey(event.startsAt),
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    companyName: event.companyName,
    location: event.location,
    headcount: event.headcount,
    statusLabel: BUSINESS_STATUS[event.status] ?? event.status,
    serviceLabel: event.serviceLabel ?? "Sức khỏe định kỳ cho cả công ty",
    aiAdvice: businessAdvice({ companyName: event.companyName, headcount: event.headcount, location: event.location }),
  }));

  const previousMonth = dayKey(new Date(safeMonthStart.getTime() - 24 * 60 * 60_000)).slice(0, 7);
  const nextMonth = dayKey(nextMonthStart).slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(safeMonthStart);

  return (
    <div className="mx-auto max-w-4xl px-3 py-3 sm:px-6 sm:py-5">
      <TherapistCalendarSchedule days={days} regular={regular} business={business} previousMonth={previousMonth} nextMonth={nextMonth} monthLabel={monthLabel} currentMonthKey={dayKey(safeMonthStart).slice(0, 7)} />
    </div>
  );
}
