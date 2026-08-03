import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";

export async function GET() {
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || ["THERAPIST", "INVESTOR"].includes(session.role)) {
    return NextResponse.json({ error: "Không có quyền xem số lượng Booking." }, { status: 403 });
  }

  const branchScope = session.role === "OWNER" ? {} : { branchId: session.branchId ?? "__none__" };
  const [regular, business] = await Promise.all([
    db.bookingGroup.count({
      where: {
        ...branchScope,
        status: "PENDING",
        holdExpiresAt: { gt: new Date() },
      },
    }),
    db.officeEvent.count({
      where: {
        ...branchScope,
        status: { in: ["AWAITING_DEPOSIT", "DEPOSIT_CONFIRMED"] },
      },
    }),
  ]);

  return NextResponse.json({ regular, business });
}
