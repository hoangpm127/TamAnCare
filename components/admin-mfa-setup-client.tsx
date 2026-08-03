"use client";

import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Copy, KeyRound, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";

type SetupPayload = { manualKey: string; provisioningUri: string; expiresAt: string };

export function AdminMfaSetupClient({ displayName, alreadyEnabled, landingPath = "/admin" }: { displayName: string; alreadyEnabled: boolean; landingPath?: string }) {
  const router = useRouter();
  const [setup, setSetup] = useState<SetupPayload | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [savedCodes, setSavedCodes] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!setup) return;
    let active = true;
    QRCode.toDataURL(setup.provisioningUri, { width: 260, margin: 1, errorCorrectionLevel: "M" })
      .then((value) => { if (active) setQrDataUrl(value); })
      .catch(() => { if (active) setError("Không thể tạo QR. Hãy nhập khóa thủ công."); });
    return () => { active = false; };
  }, [setup]);

  async function beginSetup(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/admin-auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Không thể bắt đầu thiết lập MFA.");
      setSetup(payload);
      setCurrentPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể bắt đầu thiết lập MFA.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmSetup(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/admin-auth/mfa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Không thể xác nhận MFA.");
      setRecoveryCodes(payload.recoveryCodes ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xác nhận MFA.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCodes() {
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setSavedCodes(true);
  }

  if (alreadyEnabled && recoveryCodes.length === 0) {
    return (
      <section className="w-full max-w-lg rounded-3xl bg-[#fffaf6] p-6 text-center shadow-2xl ring-1 ring-white/10">
        <CheckCircle2 className="mx-auto text-emerald-700" size={36} />
        <h1 className="mt-3 text-xl font-semibold">MFA đang được bảo vệ</h1>
        <p className="mt-2 text-sm leading-6 text-[#786a63]">Tài khoản {displayName} yêu cầu mã Authenticator hoặc mã khôi phục dùng một lần khi đăng nhập.</p>
        <button type="button" onClick={() => router.replace(landingPath)} className="mt-5 rounded-full bg-[#d13f1f] px-6 py-3 text-sm font-semibold text-white">Vào Trung tâm quản trị</button>
      </section>
    );
  }

  if (recoveryCodes.length > 0) {
    return (
      <section className="w-full max-w-xl rounded-3xl bg-[#fffaf6] p-5 shadow-2xl ring-1 ring-white/10 sm:p-7">
        <CheckCircle2 className="mx-auto text-emerald-700" size={34} />
        <h1 className="mt-3 text-center text-xl font-semibold">MFA đã được bật</h1>
        <p className="mt-2 text-center text-xs leading-5 text-[#786a63]">Lưu các mã dưới đây ở nơi an toàn. Mỗi mã chỉ dùng một lần và sẽ không hiển thị lại.</p>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-white p-4 font-mono text-xs font-semibold ring-1 ring-[#eadbd1]">
          {recoveryCodes.map((item) => <code key={item} className="rounded-lg bg-[#fff7ec] px-2 py-2 text-center">{item}</code>)}
        </div>
        <button type="button" onClick={() => void copyCodes()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-[#d13f1f] px-5 py-2.5 text-xs font-semibold text-[#d13f1f]"><Copy size={14} /> Sao chép mã khôi phục</button>
        <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#554842]"><input type="checkbox" checked={savedCodes} onChange={(event) => setSavedCodes(event.target.checked)} className="mt-1 h-4 w-4 accent-[#d13f1f]" /> Tôi đã lưu mã khôi phục ngoài thiết bị này.</label>
        <button type="button" disabled={!savedCodes} onClick={() => { router.replace(landingPath); router.refresh(); }} className="mt-4 w-full rounded-full bg-[#d13f1f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Tiếp tục vào quản trị</button>
      </section>
    );
  }

  return (
    <section className="w-full max-w-xl rounded-3xl bg-[#fffaf6] p-5 shadow-2xl ring-1 ring-white/10 sm:p-7">
      <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fff0ed] text-[#d13f1f]"><ShieldCheck size={22} /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d13f1f]">Bảo vệ tài khoản quản trị</p><h1 className="mt-1 text-xl font-semibold">Thiết lập Authenticator</h1><p className="mt-1 text-xs leading-5 text-[#786a63]">Mã thay đổi mỗi 30 giây và nằm ngoài mật khẩu.</p></div></div>

      {!setup ? (
        <form onSubmit={beginSetup} className="mt-5 space-y-3">
          <label className="block text-xs font-semibold">Xác nhận mật khẩu hiện tại
            <span className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#eadbd1] bg-white px-3"><LockKeyhole size={15} className="text-[#8a7a72]" /><input required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" className="min-w-0 flex-1 py-3 text-sm outline-none" /></span>
          </label>
          {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p> : null}
          <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#d13f1f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{submitting ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />} Bắt đầu thiết lập</button>
        </form>
      ) : (
        <form onSubmit={confirmSetup} className="mt-5">
          <p className="text-center text-xs font-semibold">1. Quét QR bằng Google/Microsoft Authenticator</p>
          <div className="mx-auto mt-3 flex h-[260px] w-[260px] items-center justify-center rounded-2xl bg-white p-2 ring-1 ring-[#eadbd1]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qrDataUrl ? <img src={qrDataUrl} alt="QR thiết lập Authenticator" className="h-full w-full" /> : <Loader2 className="animate-spin text-[#d13f1f]" />}
          </div>
          <div className="mt-3 rounded-xl bg-[#fff7ec] p-3 text-center"><p className="text-[10px] text-[#786a63]">Không quét được? Nhập khóa thủ công</p><code className="mt-1 block break-all font-mono text-xs font-semibold text-[#5c2718]">{setup.manualKey}</code></div>
          <label className="mt-4 block text-center text-xs font-semibold">2. Nhập mã 6 số đang hiển thị
            <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="mx-auto mt-2 block w-48 rounded-xl border border-[#eadbd1] bg-white px-3 py-3 text-center font-mono text-xl tracking-[0.35em] outline-none focus:border-[#d13f1f]" />
          </label>
          {error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p> : null}
          <button disabled={submitting} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#d13f1f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{submitting ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />} Xác nhận và bật MFA</button>
        </form>
      )}
    </section>
  );
}
