import { Download, QrCode } from "lucide-react";

export function TherapistQrCard({ dataUrl, therapistName, branchLabel, compact = false }: { dataUrl: string; therapistName: string; branchLabel: string; compact?: boolean }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e8d2c4] bg-gradient-to-br from-[#fbf2e7] to-white p-4 shadow-sm">
      <div className={compact ? "text-center" : "grid items-center gap-4 sm:grid-cols-[190px_1fr]"}>
        <div className="mx-auto w-fit rounded-2xl border border-[#f1e5dd] bg-white p-2 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt={`QR check-in KTV ${therapistName}`} className={compact ? "h-36 w-36" : "h-44 w-44"} />
        </div>
        <div className={compact ? "mt-3" : "min-w-0"}>
          <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#76551d] sm:justify-start"><QrCode size={13} /> QR KTV riêng</p>
          <h2 className="mt-1 text-base font-semibold">{therapistName}</h2>
          <p className="mt-0.5 text-xs text-[#68574f]">{branchLabel}</p>
          <p className="mt-2 text-[11px] leading-5 text-[#68574f]">Khách quét mã này sẽ vào đúng Bill đã phân công cho KTV, bắt đầu hoặc mở thẳng đồng hồ đang phục vụ. QR không làm lộ Bill của khách khác.</p>
          <a href={dataUrl} download={`taman-ktv-${therapistName.toLocaleLowerCase("vi").replace(/\s+/g, "-")}.png`} className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#76551d] px-4 py-2.5 text-xs font-semibold text-white"><Download size={14} /> Tải QR KTV</a>
        </div>
      </div>
    </section>
  );
}
