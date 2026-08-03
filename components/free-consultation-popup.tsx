"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, Check, Clock3, HeartPulse, Loader2, ShieldCheck } from "lucide-react";
import { CUSTOMER_ACCOUNT_CHANGED_EVENT, type CustomerAccountView } from "@/lib/customer-account";

type PreferredTime = "MORNING" | "AFTERNOON" | "EVENING";

const TIME_OPTIONS: Array<{ value: PreferredTime; label: string; detail: string }> = [
  { value: "MORNING", label: "Buổi sáng", detail: "08:00–12:00" },
  { value: "AFTERNOON", label: "Buổi chiều", detail: "12:00–18:00" },
  { value: "EVENING", label: "Buổi tối", detail: "18:00–21:00" },
];

export function FreeConsultationPopup() {
  const [open, setOpen] = useState(false);
  const [preferredTime, setPreferredTime] = useState<PreferredTime>("MORNING");
  const [submitting, setSubmitting] = useState<"INTERESTED" | "DECLINED" | null>(null);
  const [error, setError] = useState("");

  const refreshEligibility = useCallback(async () => {
    try {
      const response = await fetch("/api/customer-auth/session", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { account?: CustomerAccountView | null };
      setOpen(Boolean(payload.account?.freeConsultationPrompt?.eligible));
    } catch {
      // Sẽ kiểm tra lại khi phiên tài khoản thay đổi hoặc người dùng tải lại trang.
    }
  }, []);

  useEffect(() => {
    const onAccountChanged = () => { void refreshEligibility(); };
    const initialCheck = window.setTimeout(onAccountChanged, 0);
    window.addEventListener(CUSTOMER_ACCOUNT_CHANGED_EVENT, onAccountChanged);
    return () => {
      window.clearTimeout(initialCheck);
      window.removeEventListener(CUSTOMER_ACCOUNT_CHANGED_EVENT, onAccountChanged);
    };
  }, [refreshEligibility]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  async function saveDecision(decision: "INTERESTED" | "DECLINED") {
    setSubmitting(decision);
    setError("");
    try {
      const response = await fetch("/api/customer-consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, preferredTime: decision === "INTERESTED" ? preferredTime : null }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Không thể lưu lựa chọn lúc này.");
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể lưu lựa chọn lúc này.");
    } finally {
      setSubmitting(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#2c0909]/74 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="free-consultation-title"
        aria-describedby="free-consultation-description"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-[#fffdf7] shadow-2xl ring-1 ring-[#e1bb58]/45 sm:rounded-[2rem]"
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-[#4d0c10] via-[#8f151a] to-[#d13f1f] px-5 pb-5 pt-6 text-white sm:px-6">
          <div className="absolute -right-10 -top-14 h-36 w-36 rounded-full border-[18px] border-[#d8b449]/15" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f2d477]/35 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#f5dc8f]">
              <HeartPulse size={13} /> Dành riêng cho thành viên mới
            </span>
            <h2 id="free-consultation-title" className="mt-3 text-[23px] font-semibold leading-tight tracking-tight text-[#f8e3a3] sm:text-3xl">
              Đăng ký đánh giá & tư vấn miễn phí
            </h2>
            <p id="free-consultation-description" className="mt-2 text-sm leading-6 text-white/85">
              Đau mỏi cổ vai gáy, lưng hoặc cơ xương khớp được chuyên gia có trên 20 năm kinh nghiệm đánh giá ban đầu và gợi ý lộ trình chăm sóc phù hợp ngay tại Tâm An Center.
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="grid grid-cols-3 gap-2">
            {TIME_OPTIONS.map((option) => {
              const active = preferredTime === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPreferredTime(option.value)}
                  className={`rounded-2xl border px-2 py-3 text-center transition ${active ? "border-[#b4232b] bg-[#fff2ef] text-[#7a1718] shadow-sm" : "border-[#e8ddc7] bg-white text-[#665b55]"}`}
                >
                  <Clock3 className="mx-auto" size={16} />
                  <strong className="mt-1.5 block text-xs">{option.label}</strong>
                  <span className="mt-0.5 block text-[10px] opacity-70">{option.detail}</span>
                  {active ? <Check className="mx-auto mt-1 text-[#b68820]" size={13} /> : null}
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl bg-[#f7f1df] p-3 text-[11px] leading-5 text-[#66563f] ring-1 ring-[#e7d6aa]">
            <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 shrink-0 text-[#a92f18]" size={15} /><span>Bằng việc đăng ký, bạn đồng ý để đội ngũ liên hệ số điện thoại tài khoản nhằm xác nhận lịch. Buổi tư vấn giúp định hướng chăm sóc, không thay thế khám, chẩn đoán hoặc điều trị y khoa.</span></p>
          </div>

          {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p> : null}

          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => void saveDecision("INTERESTED")}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#d13f1f] to-[#8f151a] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#8f151a]/20 disabled:opacity-60"
          >
            {submitting === "INTERESTED" ? <Loader2 className="animate-spin" size={17} /> : <CalendarCheck size={17} />}
            Đăng ký tư vấn miễn phí
          </button>
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => void saveDecision("DECLINED")}
            className="w-full rounded-full px-5 py-2.5 text-xs font-semibold text-[#71675d] disabled:opacity-60"
          >
            {submitting === "DECLINED" ? "Đang lưu lựa chọn…" : "Không tham gia và không hỏi lại"}
          </button>
        </div>
      </section>
    </div>
  );
}
