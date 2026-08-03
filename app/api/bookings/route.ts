import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookingGroupToDto, bookingToDto, createBookingGroup } from "@/lib/server/booking-dal";
import { bookingSchema } from "@/lib/validations";
import { getAdminSession } from "@/lib/server/admin-session";
import { getCustomerSession } from "@/lib/server/customer-session";
import { getGuestSession } from "@/lib/server/guest-session";
import { isSameOriginMutation, privateIdentifierDigest, requestIp } from "@/lib/server/request-security";

const GROUP_INCLUDE = {
  branch: true,
  customer: true,
  payments: { orderBy: { createdAt: "desc" as const } },
  bookings: {
    include: { service: true, therapist: true, room: true, customerPackage: { include: { packagePlan: true } } },
    orderBy: { startTime: "asc" as const },
  },
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const branchId = url.searchParams.get("branchId") ?? undefined;
  const phone = url.searchParams.get("phone") ?? undefined;
  const referenceCode = url.searchParams.get("referenceCode") ?? undefined;
  const customerAudience = url.searchParams.get("audience") === "customer";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 300);

  try {
    if (phone) return NextResponse.json({ error: "Tra cứu booking bằng số điện thoại đã được thay bằng phiên xác thực an toàn." }, { status: 400 });
    const [adminSession, customerSession, guestSession] = await Promise.all([
      customerAudience ? Promise.resolve(null) : getAdminSession(),
      getCustomerSession(),
      getGuestSession(),
    ]);
    const usableAdmin = adminSession
      && !adminSession.mustChangePassword
      && !["INVESTOR", "THERAPIST"].includes(adminSession.role)
      ? adminSession
      : null;
    if (!customerAudience && adminSession && !usableAdmin) return NextResponse.json({ error: "Vai trò hiện tại không được truy cập dữ liệu booking." }, { status: 403 });
    if (!usableAdmin && !customerSession && !guestSession) return NextResponse.json({ error: "Bạn chưa có phiên truy cập booking hợp lệ." }, { status: 401 });

    const scopedBranchId = usableAdmin
      ? (usableAdmin.role === "OWNER" ? branchId : usableAdmin.branchId ?? "__none__")
      : branchId;
    const guestGrants = !usableAdmin && !customerSession && guestSession
      ? await db.bookingAccessGrant.findMany({
          where: { guestSessionId: guestSession.id, expiresAt: { gt: new Date() } },
          select: { bookingGroupId: true, bookingId: true },
        })
      : [];
    const guestGroupIds = guestGrants.map((item) => item.bookingGroupId).filter((id): id is string => Boolean(id));
    const guestBookingIds = guestGrants.map((item) => item.bookingId).filter((id): id is string => Boolean(id));
    const groupScope = usableAdmin
      ? {}
      : customerSession
        ? { customerId: customerSession.customerId }
        : { id: { in: guestGroupIds } };
    const bookingScope = usableAdmin
      ? {}
      : customerSession
        ? { customerId: customerSession.customerId }
        : { id: { in: guestBookingIds } };
    const [groups, directBookings] = await Promise.all([
      db.bookingGroup.findMany({
        where: {
          ...groupScope,
          ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
          ...(referenceCode ? { referenceCode } : {}),
        },
        include: GROUP_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      db.booking.findMany({
        where: {
          ...bookingScope,
          groupId: null,
          ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
          ...(referenceCode ? { bookingCode: referenceCode } : {}),
        },
        include: { branch: true, customer: true, service: true, therapist: true, room: true, customerPackage: { include: { packagePlan: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);
    const bookings = [...groups.map(bookingGroupToDto), ...directBookings.map(bookingToDto)]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
    return NextResponse.json({
      bookings,
      persisted: true,
      ...(customerAudience ? { authenticated: Boolean(customerSession) } : {}),
    });
  } catch (error) {
    console.error("bookings.list_failed", error);
    return NextResponse.json({ error: "Không thể tải dữ liệu booking." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !["OWNER", "BRANCH_MANAGER", "RECEPTIONIST"].includes(session.role)) {
    return NextResponse.json({ error: "Chỉ đội ngũ vận hành được tạo booking tại quầy." }, { status: 403 });
  }
  const parsed = bookingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Thông tin booking chưa hợp lệ.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const bookingCode = input.bookingCode?.trim();
  if (!bookingCode) return NextResponse.json({ error: "Thiếu mã booking." }, { status: 400 });
  const requestedBranchId = input.branchId ?? "cs1";
  if (session.role !== "OWNER" && requestedBranchId !== session.branchId) {
    return NextResponse.json({ error: "Bạn chỉ được tạo booking tại cơ sở phụ trách." }, { status: 403 });
  }

  try {
    const group = await createBookingGroup({
      referenceCode: bookingCode,
      branchId: requestedBranchId,
      customerName: input.customerName?.trim() || "Khách Tâm An",
      customerPhone: input.customerPhone?.trim() || `GUEST-${bookingCode}`,
      voucherCode: input.voucherCode,
      campaignCode: input.campaignCode,
      source: input.source,
      actorUserId: session.id,
      auditIpHash: privateIdentifierDigest(requestIp(request)),
      units: [{
        bookingCode,
        serviceId: input.serviceId,
        startTime: input.startTime,
        therapistId: input.therapistId,
        note: input.note,
        source: input.source,
      }],
    });
    return NextResponse.json({ bookingCode: group.referenceCode, persisted: true, booking: bookingGroupToDto(group) }, { status: 201 });
  } catch (error) {
    console.error("booking.create_failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể lưu booking." }, { status: 409 });
  }
}
