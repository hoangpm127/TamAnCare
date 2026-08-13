import QRCode from "qrcode";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AdminQrManagement } from "@/components/admin-qr-management";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/server/admin-session";
import { businessScanUrl, createBusinessQrToken } from "@/lib/server/business-qr";

export const dynamic = "force-dynamic";

function qrOptions(dark: string) {
  return { width: 360, margin: 1, errorCorrectionLevel: "H" as const, color: { dark, light: "#ffffff" } };
}

export default async function AdminQrManagementPage() {
  const session = await getAdminSession();
  if (!session || session.mustChangePassword || !["OWNER", "BRANCH_MANAGER"].includes(session.role)) notFound();
  const scope = session.role === "OWNER" ? {} : { id: session.branchId ?? "__none__" };
  const branches = await db.branch.findMany({ where: scope, orderBy: { createdAt: "asc" } });
  const branchIds = branches.map((item) => item.id);
  const businessEvents = await db.officeEvent.findMany({ where: { branchId: { in: branchIds }, status: { not: "CANCELLED" } }, include: { branch: { select: { name: true } }, leadTherapist: true }, orderBy: { startsAt: "desc" }, take: 60 });
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : undefined;

  const directLink = new URL("/tai-co-so", origin ?? "https://tamancare-production.up.railway.app").toString();
  const directItem = {
    id: "venue-direct",
    targetType: "DIRECT" as const,
    title: "Khách trực tiếp tại cơ sở",
    subtitle: "Một mã dùng chung · Không qua Affiliate",
    branchLabel: "Toàn bộ TÂM AN CENTER",
    version: null,
    link: directLink,
    dataUrl: await QRCode.toDataURL(directLink, qrOptions("#8b2424")),
    status: "Nguồn: khách trực tiếp",
  };

  const businessItems = await Promise.all(businessEvents.map(async (event) => {
    const link = event.leadTherapist ? businessScanUrl(createBusinessQrToken({ eventCode: event.eventCode, leadTherapistId: event.leadTherapist.id, version: event.qrVersion }), origin) : null;
    return { id: event.id, targetType: "BUSINESS" as const, title: event.companyName, subtitle: `${event.eventCode} · ${event.location}`, branchLabel: event.branch.name.replace(/^Tâm An Center · /, ""), version: event.qrVersion, link, dataUrl: link ? await QRCode.toDataURL(link, qrOptions("#2452b8")) : null, status: event.leadTherapist ? `KTV trưởng: ${event.leadTherapist.fullName}` : "Chờ phân công KTV trưởng" };
  }));

  return <AdminQrManagement items={[directItem, ...businessItems]} role={session.role as "OWNER" | "BRANCH_MANAGER"} />;
}
