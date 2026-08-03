import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { Download, MapPin, QrCode as QrCodeIcon } from "lucide-react";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { createVenueQrToken, venueCheckinUrl } from "@/lib/server/venue-qr";
import { BrandWordmark } from "@/components/brand-wordmark";

export const metadata = {
  title: "QR check-in cơ sở | Tâm An Center",
};

export const dynamic = "force-dynamic";

export default async function BranchQrPage() {
  const branches = await db.branch.findMany({ orderBy: { id: "asc" } });
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : undefined;
  const qrCards = await Promise.all(branches.map(async (branch) => ({
    id: branch.id,
    label: branch.name.replace(/^Tâm An Center · /, ""),
    address: branch.address,
    dataUrl: await QRCode.toDataURL(venueCheckinUrl(createVenueQrToken({ branchId: branch.id, version: branch.qrVersion }), origin), {
      margin: 2,
      width: 420,
      errorCorrectionLevel: "H",
      color: { dark: "#4c191b", light: "#ffffff" },
    }),
  })));

  return (
    <main className="min-h-screen bg-[#f7f3ef] px-4 py-6 text-[#281b18] sm:px-6">
      <section className="mx-auto max-w-3xl">
        <header className="text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#a85f29] text-white shadow-lg"><QrCodeIcon size={22} /></span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">QR check-in Tâm An Center</h1>
          <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-[#68574f]">Mở trang này trên máy tính hoặc in từng mã đặt tại quầy. Khách dùng điện thoại quét đúng mã của cơ sở đang đến.</p>
        </header>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {qrCards.map((branch) => (
            <article key={branch.id} className="rounded-3xl border border-[#f1e5dd] bg-white p-5 text-center shadow-[0_14px_36px_rgba(76,25,27,0.10)]">
              <BrandWordmark className="mx-auto h-[18px] w-[138px] text-[#a85f29]" />
              <h2 className="mt-1 text-xl font-semibold">{branch.label}</h2>
              <Image unoptimized width={420} height={420} src={branch.dataUrl} alt={`QR check-in ${branch.label}`} className="mx-auto mt-3 h-auto w-full max-w-[300px] rounded-2xl" priority />
              <p className="mx-auto mt-3 flex max-w-xs items-start justify-center gap-1.5 text-xs leading-5 text-[#68574f]"><MapPin size={14} className="mt-0.5 shrink-0 text-[#a85f29]" /> {branch.address}</p>
              <a href={branch.dataUrl} download={`taman-care-${branch.id}.png`} className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full border border-[#a85f29] px-4 py-2 text-xs font-semibold text-[#a85f29]"><Download size={14} /> Tải QR {branch.label}</a>
            </article>
          ))}
        </div>

        <div className="mt-5 rounded-2xl bg-[#4c191b] p-4 text-center text-white">
          <p className="text-sm font-semibold">Kiểm thử ngay trên điện thoại</p>
          <p className="mt-1 text-xs leading-5 text-white/70">Đăng nhập tài khoản có booking đã xác nhận, mở camera trong luồng check-in rồi hướng vào một trong hai mã phía trên.</p>
          <Link href="/check-in" className="mt-3 inline-flex rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-[#4c191b]">Mở camera check-in</Link>
        </div>
      </section>
    </main>
  );
}
