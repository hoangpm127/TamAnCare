"use client";

import { addMinutes, format } from "date-fns";
import { useMemo, useState } from "react";
import { CheckCircle2, QrCode } from "lucide-react";
import { CompactSelect } from "@/components/compact-select";

export type OfficeEventRegistrationView = {
  eventCode: string;
  companyName: string;
  location: string;
  startsAt: string;
  endsAt: string;
  slotMinutes: number;
  voucherCode: string | null;
  status: string;
  headcount: number;
  registered: number;
};

export function OfficeRegistrationForm({ event }: { event: OfficeEventRegistrationView }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [slotTime, setSlotTime] = useState(event.startsAt);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const slots = useMemo(() => {
    const result: Date[] = [];
    const startsAt = new Date(event.startsAt);
    const endsAt = new Date(event.endsAt);
    for (let cursor = startsAt; cursor < endsAt; cursor = addMinutes(cursor, event.slotMinutes)) {
      result.push(cursor);
    }
    return result;
  }, [event.endsAt, event.slotMinutes, event.startsAt]);

  async function submit() {
    if (fullName.trim().length < 2 || phone.replace(/\D/g, "").length < 8) {
      setError("Vui lòng nhập đúng họ tên và số điện thoại.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/office-events/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventCode: event.eventCode, fullName, phone, slotTime }),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Không thể đăng ký slot lúc này.");
      setDone(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đăng ký slot lúc này.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="bg-[#fdf8f3] px-4 py-6 text-[#281b18] sm:px-6">
      <section className="mx-auto max-w-3xl rounded-xl border border-[#e7d6ca] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#c64b32]">Tâm An Business</p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{event.companyName}</h1>
            <p className="mt-2 text-sm text-[#68574f]">{event.location}</p>
            <p className="mt-1 text-xs text-[#826f66]">Đã đăng ký {event.registered}/{event.headcount} người</p>
          </div>
          <div className="rounded-xl border border-[#e7d6ca] p-3">
            <QrCode className="text-[#c64b32]" />
          </div>
        </div>

        {done ? (
          <div className="mt-5 rounded-xl bg-[#fffaf6] p-4 text-sm text-[#76551d]">
            <CheckCircle2 className="mb-2" />
            Đăng ký thành công. Voucher của bạn: <strong>{event.voucherCode}</strong>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold">Họ tên</span>
              <input value={fullName} onChange={(target) => setFullName(target.currentTarget.value)} className="mt-2 w-full rounded-xl border border-[#e7d6ca] px-3 py-3" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Số điện thoại</span>
              <input value={phone} onChange={(target) => setPhone(target.currentTarget.value)} className="mt-2 w-full rounded-xl border border-[#e7d6ca] px-3 py-3" />
            </label>
            <div>
              <p className="text-sm font-semibold">Chọn slot</p>
              <CompactSelect className="mt-2" value={slotTime} onValueChange={setSlotTime} dialogTitle="Chọn giờ chăm sóc" triggerClassName="py-3 text-sm font-normal" options={slots.map((slot) => ({ value: slot.toISOString(), label: format(slot, "HH:mm dd/MM") }))} />
            </div>
            {error ? <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p> : null}
            <button type="button" disabled={submitting || !["DEPOSIT_CONFIRMED", "READY"].includes(event.status)} onClick={submit} className="w-full rounded-full bg-[#c64b32] px-5 py-3 font-semibold text-white disabled:opacity-50">
              {submitting ? "Đang ghi nhận…" : "Đăng ký slot"}
            </button>
            {!["DEPOSIT_CONFIRMED", "READY"].includes(event.status) ? <p className="text-center text-xs text-[#826f66]">Đoàn chưa mở đăng ký hoặc đã kết thúc.</p> : null}
          </div>
        )}
      </section>
    </main>
  );
}
