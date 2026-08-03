import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { bookingStatusLabel, resourceStatusLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/utils";
import { canAccessAdminSection } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !canAccessAdminSection(session, "customers")) notFound();
  const customer = await db.customer.findFirst({
    where: {
      id,
      ...(session.role === "OWNER" ? {} : {
        OR: [
          { bookings: { some: { branchId: session.branchId ?? "__none__" } } },
          { firstSource: { endsWith: `:${session.branchId ?? "__none__"}` } },
        ],
      }),
    },
    include: {
      favoriteTherapist: true,
      packages: { include: { packagePlan: true }, orderBy: { createdAt: "desc" } },
      bookings: {
        where: session.role === "OWNER" ? {} : { branchId: session.branchId ?? "__none__" },
        include: { service: true, therapist: true, branch: true },
        orderBy: { startTime: "desc" },
        take: 30,
      },
    },
  });
  if (!customer) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-10">
      <section className="rounded-lg border border-[#eadbd1] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d13f1f]">CRM profile</p>
        <h1 className="mt-1 text-2xl font-semibold">{customer.fullName}</h1>
        <p className="mt-2 text-[#665b55]">{customer.phone}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          <Metric label="Phân nhóm" value={resourceStatusLabel(customer.segment)} />
          <Metric label="Tổng lượt" value={customer.totalVisits} />
          <Metric label="Tổng chi" value={formatMoney(customer.totalSpend)} />
          <Metric label="KTV yêu thích" value={customer.favoriteTherapist?.fullName ?? "Chưa ghi nhận"} />
        </div>
        <div className="mt-5 rounded-lg bg-[#fff7f3] p-4 text-sm text-[#665b55]">{customer.internalNote ?? "Chưa có ghi chú CRM."}</div>
        {customer.packages.length ? <div className="mt-3 rounded-lg bg-[#fff7ec] p-4 text-sm text-[#665b55]">Gói thành viên: <strong>{customer.packages.map((item) => `${item.packagePlan.name} (${item.sessionsRemaining}/${item.sessionsTotal} buổi)`).join(", ")}</strong></div> : null}
      </section>

      <section className="mt-5 rounded-lg border border-[#eadbd1] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold">Lịch sử booking</h2>
        <div className="mt-4 space-y-3">
          {customer.bookings.map((booking) => (
            <div key={booking.id} className="rounded-lg border border-[#f2e7df] p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{booking.service.name}</p>
                  <p className="text-sm text-[#665b55]">{booking.therapist?.fullName ?? "Cơ sở sắp xếp"} · {booking.branch.name} · {formatMoney(booking.totalAmount)}</p>
                </div>
                <span className="w-fit rounded-full bg-[#fff2ef] px-3 py-1 text-xs font-semibold text-[#d13f1f]">{bookingStatusLabel(booking.status)}</span>
              </div>
            </div>
          ))}
          {customer.bookings.length === 0 ? <p className="rounded-lg border border-dashed border-[#eadbd1] p-5 text-center text-sm text-[#8a7a72]">Chưa có lịch sử booking trong phạm vi quản lý.</p> : null}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[#eadbd1] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[#665b55]">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}
