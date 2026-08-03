"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, MessageSquareText, ShieldCheck } from "lucide-react";

export function CustomerPasswordRecovery({ initialPhone, onClose }: { initialPhone: string; onClose: () => void }) {
  const [step, setStep] = useState<"request" | "confirm" | "success">("request");
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deliveryConfigured, setDeliveryConfigured] = useState(true);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/customer-auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const payload = await response.json();
      setDeliveryConfigured(payload.deliveryConfigured !== false);
      if (!response.ok) throw new Error(payload.error ?? "Không thể gửi yêu cầu khôi phục.");
      if (payload.deliveryConfigured === false) {
        setMessage("Kênh khôi phục mật khẩu đang tạm bảo trì. Vui lòng liên hệ Tâm An Center để được hỗ trợ.");
        return;
      }
      setMessage(payload.message ?? "Nếu tài khoản tồn tại, mã khôi phục sẽ được gửi.");
      setStep("confirm");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Không thể gửi yêu cầu khôi phục.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmReset(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setMessage("Hai lần nhập mật khẩu mới chưa khớp.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/customer-auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, newPassword }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Không thể đặt lại mật khẩu.");
      setStep("success");
      setMessage("Mật khẩu đã được cập nhật. Tất cả phiên đăng nhập cũ đã bị thu hồi.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Không thể đặt lại mật khẩu.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "success") {
    return (
      <section className="mt-4 rounded-2xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-200">
        <CheckCircle2 className="mx-auto text-emerald-700" size={28} />
        <h2 className="mt-2 text-sm font-semibold text-emerald-950">Khôi phục tài khoản thành công</h2>
        <p className="mt-1 text-xs leading-5 text-emerald-800">{message}</p>
        <button type="button" onClick={onClose} className="mt-3 rounded-full bg-emerald-700 px-5 py-2.5 text-xs font-semibold text-white">Quay lại đăng nhập</button>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-2xl bg-[#fff8f3] p-4 ring-1 ring-[#eadbd1]">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#d13f1f] ring-1 ring-[#eadbd1]">
          {step === "request" ? <MessageSquareText size={17} /> : <KeyRound size={17} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{step === "request" ? "Khôi phục bằng mã xác nhận" : "Nhập mã và mật khẩu mới"}</h2>
          <p className="mt-1 text-[11px] leading-5 text-[#786a63]">Mã gồm 8 số, chỉ dùng một lần và hết hạn sau 10 phút.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng khôi phục mật khẩu" className="text-[#786a63]"><ArrowLeft size={17} /></button>
      </div>

      {step === "request" ? (
        <form onSubmit={requestCode} className="mt-3 space-y-3">
          <label className="block text-xs font-semibold">Số điện thoại tài khoản
            <input required inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#eadbd1] bg-white px-3 py-3 text-sm outline-none focus:border-[#d13f1f]" />
          </label>
          {message ? <p role="alert" className="text-[11px] leading-5 text-red-700">{message}</p> : null}
          {!deliveryConfigured ? <a href="/lien-he" className="inline-flex text-xs font-semibold text-[#d13f1f] underline underline-offset-2">Xem hotline các cơ sở</a> : null}
          <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#6f2821] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-60">
            {submitting ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />} Gửi mã khôi phục
          </button>
        </form>
      ) : (
        <form onSubmit={confirmReset} className="mt-3 space-y-3">
          <p className="rounded-xl bg-white p-3 text-[11px] leading-5 text-[#665b55] ring-1 ring-[#eadbd1]">{message}</p>
          {!deliveryConfigured ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-[11px] leading-5 text-amber-900 ring-1 ring-amber-200">Kênh SMS/Zalo chưa được cấu hình ở môi trường này. Chủ hệ thống cần kết nối nhà cung cấp trước khi dùng thật.</p> : null}
          <label className="block text-xs font-semibold">Mã xác nhận 8 số
            <input required inputMode="numeric" pattern="[0-9]{8}" maxLength={8} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="mt-1.5 w-full rounded-xl border border-[#eadbd1] bg-white px-3 py-3 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-[#d13f1f]" />
          </label>
          <label className="block text-xs font-semibold">Mật khẩu mới · tối thiểu 15 ký tự
            <input required type="password" minLength={15} maxLength={72} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#eadbd1] bg-white px-3 py-3 text-sm outline-none focus:border-[#d13f1f]" />
          </label>
          <label className="block text-xs font-semibold">Nhập lại mật khẩu mới
            <input required type="password" minLength={15} maxLength={72} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#eadbd1] bg-white px-3 py-3 text-sm outline-none focus:border-[#d13f1f]" />
          </label>
          <button disabled={submitting || !deliveryConfigured} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#d13f1f] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
            {submitting ? <Loader2 className="animate-spin" size={14} /> : <KeyRound size={14} />} Đặt lại mật khẩu
          </button>
        </form>
      )}
    </section>
  );
}
