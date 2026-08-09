import { createHash } from "node:crypto";
import { db } from "../lib/db";
import { hashPassword } from "../lib/password";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const marker = `KTVE2E${Date.now().toString(36).toUpperCase()}`;
const username = `owner_${marker.toLowerCase()}`;
const password = `Owner!${marker}`;
let userId: string | null = null;
let therapistId: string | null = null;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function cookieHeader(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  return values.map((value) => value.split(";", 1)[0]).filter(Boolean).join("; ");
}

async function json(path: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${path}`, init);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function dateAndWeekday(daysAhead = 3) {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60_000);
  const dateLabel = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const weekdayName = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short" }).format(date);
  const weekday = ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[weekdayName];
  return { dateLabel, weekday };
}

async function main() {
  const branch = await db.branch.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const service = await db.service.findFirstOrThrow({
    where: { isActive: true, isOnline: true, durationMin: { lte: 60 } },
    orderBy: { sortOrder: "asc" },
  });
  const user = await db.user.create({
    data: {
      name: `Owner ${marker}`,
      email: `${username}@example.test`,
      username,
      passwordHash: hashPassword(password),
      passwordChangedAt: new Date(),
      role: "OWNER",
      isActive: true,
    },
  });
  userId = user.id;

  const login = await json("/api/admin-auth/login", {
    method: "POST",
    headers: { Origin: BASE_URL, "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert(login.response.status === 200, `Đăng nhập admin test thất bại: ${login.response.status}`);
  const cookie = cookieHeader(login.response);
  assert(cookie.includes("tt_admin_session_v2="), "Đăng nhập admin chưa cấp cookie phiên bền vững.");

  const { dateLabel, weekday } = dateAndWeekday();
  const basePayload = {
    branchId: branch.id,
    fullName: `KTV ${marker}`,
    phone: "0365408910",
    avatarUrl: null,
    publicBio: "Hồ sơ kiểm thử đồng bộ quản trị và đặt lịch.",
    publicStrengths: ["Chăm sóc nhẹ nhàng"],
    skills: [service.name],
    serviceIds: [service.id],
    gender: "Nữ",
    status: "ACTIVE",
    onlineBooking: true,
    internalNote: "E2E",
    schedules: [{ weekday, startMinute: 10 * 60, endMinute: 12 * 60, isActive: true }],
  };

  const created = await json("/api/admin-therapists", {
    method: "POST",
    headers: { Origin: BASE_URL, Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(basePayload),
  });
  assert(created.response.status === 201, `Thêm KTV thất bại: ${created.response.status} ${JSON.stringify(created.payload)}`);
  therapistId = String(created.payload.therapist?.id ?? "");
  assert(therapistId, "API thêm KTV không trả về ID.");

  const persisted = await db.therapist.findUnique({ where: { id: therapistId }, include: { weeklySchedules: true, services: true } });
  assert(persisted?.weeklySchedules.length === 1 && persisted.services.some((item) => item.id === service.id), "KTV chưa lưu ca tuần hoặc dịch vụ thật.");

  const catalog = await json("/api/catalog", { headers: { Cookie: cookie }, cache: "no-store" });
  assert(catalog.response.ok && catalog.payload.therapists?.some((item: { id: string }) => item.id === therapistId), "KTV mới chưa đồng bộ sang danh sách khách hàng.");

  const availability = await json(`/api/availability?serviceId=${encodeURIComponent(service.id)}&branchId=${encodeURIComponent(branch.id)}&date=${dateLabel}&includeUnavailable=true`, { cache: "no-store" });
  assert(availability.response.ok, "Không tải được lịch trống sau khi cấu hình ca tuần.");
  const slots = availability.payload.slots as Array<{ startTime: string; availableTherapists: Array<{ id: string }> }>;
  const tenOClock = slots.find((slot) => slot.startTime.includes("T10:00:"));
  const nineOClock = slots.find((slot) => slot.startTime.includes("T09:00:"));
  assert(tenOClock?.availableTherapists.some((item) => item.id === therapistId), "KTV không xuất hiện trong ca tuần đã cấu hình.");
  assert(!nineOClock?.availableTherapists.some((item) => item.id === therapistId), "KTV vẫn xuất hiện ngoài ca tuần.");

  const updatedName = `KTV sửa ${marker}`;
  const updated = await json(`/api/admin-therapists/${therapistId}`, {
    method: "PATCH",
    headers: { Origin: BASE_URL, Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ ...basePayload, fullName: updatedName }),
  });
  assert(updated.response.ok, `Sửa KTV thất bại: ${updated.response.status}`);
  assert((await db.therapist.findUnique({ where: { id: therapistId } }))?.fullName === updatedName, "Tên KTV sửa chưa được lưu.");

  const removed = await json(`/api/admin-therapists/${therapistId}`, {
    method: "DELETE",
    headers: { Origin: BASE_URL, Cookie: cookie },
  });
  assert(removed.response.ok, `Ngừng KTV thất bại: ${removed.response.status}`);
  const hidden = await db.therapist.findUniqueOrThrow({ where: { id: therapistId } });
  assert(hidden.status === "HIDDEN" && !hidden.onlineBooking, "Ngừng KTV chưa ẩn khỏi đặt lịch nhưng vẫn giữ dữ liệu lịch sử.");

  const sessionToken = cookie.match(/tt_admin_session_v2=([^;]+)/)?.[1];
  if (sessionToken) {
    const tokenHash = createHash("sha256").update(sessionToken).digest("hex");
    assert(await db.adminSession.findUnique({ where: { tokenHash } }), "Phiên admin đã mất giữa các thao tác quản trị.");
  }

  console.log(JSON.stringify({ success: true, checks: [
    "admin_session_cookie_persists",
    "therapist_create_and_public_catalog_sync",
    "weekly_schedule_limits_customer_availability",
    "therapist_update",
    "therapist_soft_delete_preserves_history",
  ] }, null, 2));
}

async function cleanup() {
  if (therapistId) await db.therapist.deleteMany({ where: { id: therapistId } });
  if (userId) {
    await db.adminSession.deleteMany({ where: { userId } });
    await db.adminAuditLog.deleteMany({ where: { actorUserId: userId } });
    await db.user.deleteMany({ where: { id: userId } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await db.$disconnect();
  });
