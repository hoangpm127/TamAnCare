"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, Building2, CheckCircle2, Clock3, Loader2, MapPin, Play, ScanLine, ShieldCheck, StopCircle, UserRoundCheck } from "lucide-react";
import { BankTransferDetails } from "@/components/bank-transfer-details";
import { formatMoney } from "@/lib/utils";

type ScanEvent = {
  eventCode: string;
  companyName: string;
  location: string;
  serviceLabel: string | null;
  headcount: number;
  status: string;
  startsAt: string;
  expectedEndAt: string | null;
  actualStartedAt: string | null;
  actualEndedAt: string | null;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  leadTherapist: string | null;
  branchName: string;
};

type Payment = { id: string; status: string; amount: number; paymentCode: string | null };

const statusLabel: Record<string, string> = {
  AWAITING_DEPOSIT: "Chờ đối soát cọc",
  DEPOSIT_CONFIRMED: "Đã nhận cọc · chờ phân công",
  READY: "Sẵn sàng bắt đầu",
  IN_SERVICE: "Đang phục vụ",
  AWAITING_BALANCE: "Chờ thanh toán phần còn lại",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
};

function clock(seconds: number) {
  const absolute = Math.abs(seconds);
  const hours = Math.floor(absolute / 3600);
  const minutes = Math.floor((absolute % 3600) / 60);
  const secs = absolute % 60;
  return `${seconds < 0 ? "+" : ""}${hours ? `${String(hours).padStart(2, "0")}:` : ""}${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function BusinessScanClient({ token }: { token: string }) {
  const [event, setEvent] = useState<ScanEvent | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const response = await fetch(`/api/business-scan/${encodeURIComponent(token)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Không thể đọc mã QR.");
    setEvent(data.event);
  }, [token]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Không thể đọc mã QR."));
    }, 0);
    const refresh = window.setInterval(() => void load().catch(() => undefined), 15_000);
    const ticker = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(refresh); window.clearInterval(ticker); };
  }, [load]);

  useEffect(() => {
    if (!payment || payment.status === "CONFIRMED") return;
    const poll = window.setInterval(async () => {
      const response = await fetch(`/api/payments/${payment.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (data.payment?.status === "CONFIRMED") {
        setPayment((current) => current ? { ...current, status: "CONFIRMED" } : current);
        await load();
      }
    }, 3_000);
    return () => window.clearInterval(poll);
  }, [load, payment]);

  const remainingSeconds = event?.expectedEndAt
    ? Math.ceil((new Date(event.expectedEndAt).getTime() - now) / 1000)
    : null;

  useEffect(() => {
    if (event?.status !== "IN_SERVICE" || remainingSeconds !== 0) return;
    void fetch(`/api/business-scan/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "REMIND" }) });
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Tâm An Business", { body: "Đã đến giờ kết thúc. Mời quét QR để chốt phiên phục vụ." });
    }
  }, [event?.status, remainingSeconds, token]);

  async function act(action: "START" | "END") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/business-scan/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể cập nhật phiên phục vụ.");
      if (data.payment) setPayment(data.payment);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật phiên phục vụ.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !event) return <div className="mx-auto mt-10 max-w-md rounded-3xl border border-red-200 bg-white p-6 text-center text-sm text-red-700 shadow-xl">{error}</div>;
  if (!event) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="animate-spin text-[#c64b32]" /></div>;

  const canStart = ["DEPOSIT_CONFIRMED", "READY"].includes(event.status);
  const canEnd = event.status === "IN_SERVICE";
  const waitingPayment = event.status === "AWAITING_BALANCE" || Boolean(payment && payment.status !== "CONFIRMED");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ead2ac_0,#fdf8f3_38%,#f4ece6_100%)] px-4 py-6 text-[#211817]">
      <section className="mx-auto max-w-lg overflow-hidden rounded-[2rem] border border-[#d7b56d] bg-white shadow-2xl shadow-[#5f321c]/15">
        <header className="relative overflow-hidden bg-gradient-to-br from-[#241614] via-[#5b2d1e] to-[#9b1f24] px-5 pb-6 pt-5 text-white">
          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#f1d37b]/20 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#f6dd93]"><ScanLine size={13} /> QR vận hành đã xác thực</span>
            <ShieldCheck size={20} className="text-[#f6dd93]" />
          </div>
          <h1 className="relative mt-4 text-2xl font-semibold tracking-tight">{event.companyName}</h1>
          <p className="relative mt-1 text-sm text-white/75">{event.eventCode} · {statusLabel[event.status] ?? event.status}</p>
        </header>

        <div className="p-5">
          <div className="grid grid-cols-2 gap-2.5">
            <Info icon={<UserRoundCheck size={16} />} label="KTV Business trưởng" value={event.leadTherapist ?? "Chưa phân công"} />
            <Info icon={<Building2 size={16} />} label="Cơ sở phụ trách" value={event.branchName.replace("Tâm An Center · ", "")} />
            <Info icon={<MapPin size={16} />} label="Địa điểm triển khai" value={event.location} wide />
          </div>

          {event.status === "IN_SERVICE" && remainingSeconds !== null ? (
            <div className="mt-4 rounded-3xl bg-gradient-to-br from-[#4c191b] to-[#76551d] p-5 text-center text-white shadow-lg">
              <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/70"><Clock3 size={15} /> {remainingSeconds >= 0 ? "Thời gian còn lại" : "Thời gian phát sinh"}</p>
              <p className="mt-2 font-mono text-4xl font-bold tabular-nums tracking-tight">{clock(remainingSeconds)}</p>
              <p className="mt-2 text-xs text-white/70">Bắt đầu {event.actualStartedAt ? new Date(event.actualStartedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--:--"}</p>
              <p className="mt-3 rounded-2xl bg-white/10 px-3 py-2 text-[10px] leading-4 text-white/85">Tip hoàn toàn tùy tâm và trao trực tiếp cho KTV. Phần còn lại của Bill thanh toán riêng cho cơ sở, không bao gồm Tip.</p>
            </div>
          ) : null}

          {canStart ? (
            <div className="mt-4 rounded-3xl border border-[#e8d2c4] bg-[#fbf2e7] p-4 text-center">
              <Play className="mx-auto text-[#9a5a16]" size={30} />
              <h2 className="mt-2 text-lg font-semibold">Xác nhận bắt đầu phục vụ</h2>
              <p className="mt-1 text-xs leading-5 text-[#5e6e64]">Thao tác này ghi nhận giờ thực tế, địa điểm và KTV trưởng vào hồ sơ vận hành.</p>
              <button disabled={busy} onClick={() => void act("START")} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#9a5a16] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Bắt đầu tính giờ</button>
            </div>
          ) : null}

          {canEnd ? (
            <div className="mt-4 rounded-3xl border border-[#ead6a9] bg-[#fffaf0] p-4">
              <p className="flex items-center gap-2 text-sm font-semibold"><StopCircle size={17} className="text-[#c64b32]" /> Kết thúc và chốt công nợ</p>
              <p className="mt-1 text-xs leading-5 text-[#76665d]">Sau khi xác nhận kết thúc, VietQR sẽ hiện ngay số tiền còn lại {formatMoney(event.dueAmount)} cùng lựa chọn mở ứng dụng ngân hàng.</p>
              <button disabled={busy} onClick={() => void act("END")} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#c64b32] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <StopCircle size={16} />} Kết thúc dịch vụ · mở VietQR</button>
            </div>
          ) : null}

          {waitingPayment && payment?.paymentCode ? (
            <div className="mt-4">
              <div className="rounded-2xl bg-[#fff3e0] p-3 text-center"><p className="text-xs text-[#7c684e]">Phần còn lại cần đối soát</p><p className="mt-1 text-2xl font-bold text-[#c64b32]">{formatMoney(payment.amount)}</p></div>
              <BankTransferDetails amount={payment.amount} transferContent={payment.paymentCode} helperText="Bill chỉ hoàn tất sau khi ngân hàng xác nhận đúng số tiền. Tip tùy tâm được trao trực tiếp cho KTV và không chuyển chung với Bill." />
            </div>
          ) : null}

          {event.status === "COMPLETED" ? (
            <div className="mt-4 rounded-3xl border border-[#c59a3d] bg-[#fbf2e7] p-5 text-center">
              <CheckCircle2 className="mx-auto text-[#9a5a16]" size={38} />
              <h2 className="mt-2 text-xl font-semibold">Dịch vụ đã hoàn tất</h2>
              <p className="mt-1 text-xs leading-5 text-[#5e6e64]">Thời gian và thanh toán đã được đối soát. Admin, cơ sở phụ trách và KTV trưởng đã nhận cập nhật.</p>
              <Link href={`/doanh-nghiep/${event.eventCode}`} className="mt-4 inline-flex rounded-full bg-[#9a5a16] px-5 py-2.5 text-sm font-semibold text-white">Xem Bill & đánh giá</Link>
            </div>
          ) : null}

          {error ? <p className="mt-3 rounded-2xl bg-red-50 p-3 text-center text-xs font-medium text-red-700">{error}</p> : null}
          <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-[#826f66]"><BellRing size={14} className="mt-0.5 shrink-0" /> Khi hết giờ, chuông thông báo sẽ gửi tới khách, KTV trưởng và bộ phận quản lý của đúng cơ sở.</p>
        </div>
      </section>
    </main>
  );
}

function Info({ icon, label, value, wide }: { icon: React.ReactNode; label: string; value: string; wide?: boolean }) {
  return <div className={`${wide ? "col-span-2" : ""} rounded-2xl border border-[#eee1d8] bg-[#fdf8f3] p-3`}><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#c64b32]">{icon}{label}</p><p className="mt-1 text-xs font-semibold leading-5">{value}</p></div>;
}
