"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { adminLandingPath, type AdminRole } from "@/lib/admin-auth";

export function AdminChangePasswordClient({ displayName, role, mustEnrollMfa }: { displayName: string; role: AdminRole; mustEnrollMfa: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (nextPassword !== confirmation) {
      setError("Hai lần nhập mật khẩu mới chưa khớp.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/admin-auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, nextPassword }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Không thể đổi mật khẩu.");
      router.replace(mustEnrollMfa ? "/bao-mat-quan-tri" : adminLandingPath(role));
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đổi mật khẩu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#241514] px-4 py-8 text-[#191414]">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#fffaf6] p-5 shadow-2xl sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fff0ed] text-[#9f1d20]"><ShieldCheck size={22} /></span>
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9f1d20]">Bảo vệ tài khoản</p><h1 className="mt-1 text-xl font-semibold">Đổi mật khẩu trước khi tiếp tục</h1><p className="mt-1 text-xs leading-5 text-[#8a7a72]">{displayName}, phiên cũ đã bị vô hiệu hóa. Hãy đặt mật khẩu riêng không dùng ở dịch vụ khác.</p></div>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          {[
            { label: "Mật khẩu hiện tại", value: currentPassword, setter: setCurrentPassword, autoComplete: "current-password" },
            { label: "Mật khẩu mới", value: nextPassword, setter: setNextPassword, autoComplete: "new-password" },
            { label: "Nhập lại mật khẩu mới", value: confirmation, setter: setConfirmation, autoComplete: "new-password" },
          ].map((field) => (
            <label key={field.label} className="block">
              <span className="text-[11px] font-semibold">{field.label}</span>
              <span className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#eadbd1] bg-white px-3 focus-within:border-[#9f1d20]">
                <KeyRound size={15} className="text-[#8a7a72]" />
                <input required type={showPassword ? "text" : "password"} value={field.value} onChange={(event) => field.setter(event.target.value)} autoComplete={field.autoComplete} maxLength={200} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" />
                {field.label === "Mật khẩu mới" ? <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} className="text-[#8a7a72]">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button> : null}
              </span>
            </label>
          ))}
          <div className="rounded-xl bg-[#fff7ec] p-3 text-[11px] leading-5 text-[#665b55]">
            {["Tối thiểu 12 ký tự", "Có chữ hoa, chữ thường và số", "Có ít nhất một ký tự đặc biệt"].map((item) => <p key={item} className="flex items-center gap-1.5"><Check size={12} className="text-[#9f1d20]" /> {item}</p>)}
          </div>
          {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">{error}</p> : null}
          <button type="submit" disabled={submitting} className="w-full rounded-full bg-[#9f1d20] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{submitting ? "Đang cập nhật…" : "Lưu mật khẩu mới"}</button>
        </form>
      </section>
    </main>
  );
}
