import { Clock, MapPin, Navigation, Phone } from "lucide-react";
import { getPublicCatalog } from "@/lib/server/public-catalog";
import { GoogleMapEmbed } from "@/components/google-map-embed";

export const metadata = {
  title: "Liên hệ | Tâm An Center",
};

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const { branches } = await getPublicCatalog();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-[#281b18] sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight">Liên hệ Tâm An Center</h1>
      <p className="mt-2 text-sm leading-6 text-[#68574f]">
        Chọn đúng cơ sở để gọi hotline hoặc mở chỉ đường. Thông tin bên dưới được lấy trực tiếp từ hệ thống vận hành.
      </p>

      <div className="mt-5 space-y-4">
        {branches.map((branch) => {
          const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Tâm An Center ${branch.label}, ${branch.address}`)}`;
          return (
            <section key={branch.id} className="overflow-hidden rounded-2xl border border-[#e7d6ca] bg-white shadow-sm">
              <div className="border-b border-[#eee0d6] bg-[#fcf5ef] px-4 py-3">
                <h2 className="font-semibold">Tâm An Center · {branch.label}</h2>
              </div>
              <div className="space-y-3 px-4 py-4 text-sm">
                <p className="flex items-start gap-3"><MapPin className="mt-0.5 shrink-0 text-[#c64b32]" size={17} /><span>{branch.address}</span></p>
                <p className="flex items-start gap-3"><Clock className="mt-0.5 shrink-0 text-[#c64b32]" size={17} /><span>{branch.openTime}–{branch.closeTime} hằng ngày · nhận lịch cuối lúc {branch.lastBookingTime}</span></p>
                <p className="flex items-start gap-3"><Phone className="mt-0.5 shrink-0 text-[#c64b32]" size={17} /><span>{branch.phone || "Hotline đang cập nhật"}</span></p>
                <GoogleMapEmbed address={branch.address} branchLabel={branch.label} />
              </div>
              <div className="grid gap-2 border-t border-[#eee0d6] p-3 sm:grid-cols-2">
                {branch.phone ? <a href={`tel:${branch.phone.replace(/\s/g, "")}`} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#c64b32] px-4 py-2.5 text-sm font-semibold text-white"><Phone size={16} /> Gọi {branch.phone}</a> : null}
                <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full border border-[#e7d6ca] px-4 py-2.5 text-sm font-semibold text-[#51423b]"><Navigation size={16} /> Chỉ đường</a>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
