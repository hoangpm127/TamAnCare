"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, KeyRound, Loader2, Phone, Save, ShieldCheck } from "lucide-react";

type AccountView = {
  username: string | null;
  isActive: boolean;
  passwordChangedAt: string | null;
};

export function AdminTherapistCredentials({
  therapistId,
  initialPhone,
  initialAccount,
}: {
  therapistId: string;
  initialPhone: string;
  initialAccount: AccountView | null;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone);
  const [account, setAccount] = useState(initialAccount);
  const [password, setPassword] = useState("");
  const [resetPasswordToPhone, setResetPasswordToPhone] = useState(false);
  const [issuedPassword, setIssuedPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const visiblePassword = issuedPassword
    || (account && account.passwordChangedAt === null ? phone : "");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setIssuedPassword("");
    try {
      const response = await fetch(`/api/admin-therapists/${therapistId}/credentials`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          password: password || undefined,
          resetPasswordToPhone: !password && resetPasswordToPhone,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Không thể cập nhật tài khoản KTV.");
      setAccount(payload.account as AccountView);
      setIssuedPassword(String(payload.temporaryPassword ?? ""));
      setPassword("");
      setResetPasswordToPhone(false);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật tài khoản KTV.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCredentials() {
    if (!visiblePassword) return;
    await navigator.clipboard.writeText(`Tài khoản: ${phone}\nMật khẩu: ${visiblePassword}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <section className="mt-4 rounded-xl border border-[#d2ad5d] bg-gradient-to-br from-[#fffaf0] to-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a85f29]"><ShieldCheck size={14} /> Tài khoản KTV</p>
          <h2 className="mt-1 text-lg font-semibold">Đăng nhập bằng số điện thoại</h2>
          <p className="mt-1 text-xs leading-5 text-[#826f66]">Mật khẩu chỉ được lưu dưới dạng hash. Admin xem được mật khẩu tạm thời và có thể đặt lại, nhưng không thể đọc lại mật khẩu riêng mà KTV đã đổi.</p>
        </div>
        <span className={account?.isActive ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700" : "rounded-full bg-[#f8ebe5] px-2.5 py-1 text-[9px] font-bold text-[#c64b32]"}>
          {account?.isActive ? "ĐANG HOẠT ĐỘNG" : account ? "TẠM KHÓA" : "CHƯA CẤP"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#e7d6ca] bg-white p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#826f66]"><Phone size={13} /> Tài khoản / Số điện thoại</p>
          <p className="mt-2 font-mono text-base font-semibold">{(account?.username ?? phone) || "Chưa thiết lập"}</p>
        </div>
        <div className="rounded-xl border border-[#e7d6ca] bg-white p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#826f66]"><KeyRound size={13} /> Mật khẩu</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="font-mono text-base font-semibold">{visiblePassword || "••••••••••••"}</p>
            {visiblePassword ? <button type="button" onClick={() => void copyCredentials()} className="inline-flex items-center gap-1 rounded-full bg-[#fbf2e7] px-2.5 py-1.5 text-[9px] font-semibold text-[#76551d]">{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Đã chép" : "Sao chép"}</button> : null}
          </div>
          <p className="mt-1 text-[9px] text-[#826f66]">{visiblePassword ? "Mật khẩu tạm thời; KTV phải đổi sau lần đăng nhập đầu." : "KTV đã đặt mật khẩu riêng; Admin chỉ có thể đặt lại."}</p>
        </div>
      </div>

      <form onSubmit={save} className="mt-4 grid gap-3 rounded-xl border border-[#e7d6ca] bg-white p-3 sm:grid-cols-2">
        <label className="text-xs font-semibold">Số điện thoại đăng nhập
          <input required value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="off" className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]" />
        </label>
        <label className="text-xs font-semibold">Đặt mật khẩu riêng mới
          <input value={password} onChange={(event) => { setPassword(event.target.value); if (event.target.value) setResetPasswordToPhone(false); }} type="password" minLength={8} maxLength={200} autoComplete="new-password" placeholder="Để trống nếu không đổi" className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]" />
        </label>
        <label className="flex items-start gap-2 rounded-xl bg-[#fbf2e7] p-3 text-[11px] leading-5 sm:col-span-2">
          <input type="checkbox" checked={resetPasswordToPhone} onChange={(event) => { setResetPasswordToPhone(event.target.checked); if (event.target.checked) setPassword(""); }} className="mt-1" />
          <span><strong>Đặt lại mật khẩu bằng số điện thoại.</strong> Tất cả phiên đăng nhập cũ sẽ bị thu hồi và KTV phải đổi mật khẩu ở lần đăng nhập tiếp theo.</span>
        </label>
        {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700 sm:col-span-2">{error}</p> : null}
        <div className="flex justify-end sm:col-span-2">
          <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-[#c64b32] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-60">{busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu tài khoản</button>
        </div>
      </form>
    </section>
  );
}
