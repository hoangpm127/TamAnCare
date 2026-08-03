"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCircle2, Clock3, MapPin, RefreshCw, ScanLine, ShieldCheck, Users } from "lucide-react";

type LeadEvent = {
  eventCode: string;
  companyName: string;
  location: string;
  headcount: number;
  requiredTherapists: number;
  status: string;
  actualStartedAt: string | null;
  expectedEndAt: string | null;
  actualEndedAt: string | null;
};

export function BusinessLeadConsole({ initialEvent, qrDataUrl }: { initialEvent: LeadEvent; qrDataUrl: string }) {
  const [event, setEvent] = useState(initialEvent);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1_000);
    const refresh = window.setInterval(async () => {
      const response = await fetch(`/api/business-events/${encodeURIComponent(event.eventCode)}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setEvent((current) => ({ ...current, ...data.event }));
    }, 10_000);
    return () => { window.clearInterval(tick); window.clearInterval(refresh); };
  }, [event.eventCode]);

  const seconds = useMemo(() => event.expectedEndAt ? Math.ceil((new Date(event.expectedEndAt).getTime() - now) / 1000) : null, [event.expectedEndAt, now]);
  const time = seconds === null ? "--:--" : `${seconds < 0 ? "+" : ""}${String(Math.floor(Math.abs(seconds) / 60)).padStart(2, "0")}:${String(Math.abs(seconds) % 60).padStart(2, "0")}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="overflow-hidden rounded-[2rem] border border-[#d7b56d] bg-white shadow-xl">
        <div className="bg-gradient-to-br from-[#241614] via-[#5b2d1e] to-[#9b1f24] p-5 text-center text-white">
          <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#f6dd93]"><ShieldCheck size={13} /> QR riêng của KTV Business trưởng</p>
          <h1 className="mt-2 text-xl font-semibold">{event.companyName}</h1>
          <p className="mt-1 text-xs text-white/70">{event.eventCode}</p>
        </div>
        <div className="p-5 text-center">
          <div className="mx-auto w-fit rounded-3xl border border-[#eadbd1] bg-white p-3 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt={`QR vận hành ${event.eventCode}`} className="h-60 w-60" />
          </div>
          <p className="mt-4 text-sm font-semibold">Mời người đặt dịch vụ quét mã</p>
          <p className="mt-1 text-xs leading-5 text-[#76665d]">Cùng một mã QR sẽ tự nhận biết đúng bước: bắt đầu, kết thúc hoặc thanh toán.</p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#eadbd1] bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9f1d20]">Bảng điều phối trực tiếp</p><h2 className="mt-1 text-xl font-semibold">Trạng thái buổi phục vụ</h2></div><RefreshCw size={20} className="text-[#9f1d20]" /></div>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Info icon={<MapPin size={15} />} label="Địa điểm" value={event.location} wide />
          <Info icon={<Users size={15} />} label="Quy mô" value={`${event.headcount} người`} />
          <Info icon={<ScanLine size={15} />} label="Đội triển khai" value={`${event.requiredTherapists} KTV`} />
        </div>
        {event.status === "IN_SERVICE" ? <div className="mt-4 rounded-3xl bg-gradient-to-br from-[#173f2d] to-[#0d6b44] p-5 text-center text-white"><p className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider text-white/70"><Clock3 size={15} /> {seconds !== null && seconds < 0 ? "Đang quá giờ" : "Còn lại"}</p><p className="mt-2 font-mono text-5xl font-bold tabular-nums">{time}</p><p className="mt-2 text-xs text-white/70">Chuông sẽ tự nhắc các bên khi đồng hồ về 00:00.</p></div> : null}
        {event.status === "READY" ? <State icon={<ScanLine size={28} />} title="Sẵn sàng bắt đầu" body="Đưa mã QR cho người đặt dịch vụ quét để bắt đầu tính giờ." /> : null}
        {event.status === "AWAITING_BALANCE" ? <State icon={<BellRing size={28} />} title="Đang chờ thanh toán" body="Giữ màn hình QR mở để khách hoàn tất VietQR; hệ thống sẽ tự đối soát." /> : null}
        {event.status === "COMPLETED" ? <State icon={<CheckCircle2 size={30} />} title="Đã hoàn tất" body="Thời gian, Bill và đánh giá đã được khóa vào báo cáo Business." /> : null}
        <div className="mt-4 rounded-2xl bg-[#fff7ec] p-3 text-xs leading-5 text-[#765b35]">Mã QR tự hết hiệu lực nếu Admin đổi KTV trưởng. Không chụp và gửi mã ra ngoài nhóm triển khai.</div>
      </section>
    </div>
  );
}

function Info({ icon, label, value, wide }: { icon: React.ReactNode; label: string; value: string; wide?: boolean }) {
  return <div className={`${wide ? "col-span-2" : ""} rounded-2xl bg-[#fffaf6] p-3`}><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#9f1d20]">{icon}{label}</p><p className="mt-1 text-xs font-semibold leading-5">{value}</p></div>;
}

function State({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <div className="mt-4 rounded-3xl border border-[#ead6a9] bg-[#fffaf0] p-5 text-center text-[#684c27]"><span className="inline-flex text-[#9f1d20]">{icon}</span><p className="mt-2 text-lg font-semibold text-[#211817]">{title}</p><p className="mt-1 text-xs leading-5">{body}</p></div>;
}
