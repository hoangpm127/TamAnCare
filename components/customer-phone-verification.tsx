"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MessageSquareText, ShieldCheck } from "lucide-react";

type VerificationPurpose = "CUSTOMER_SIGNUP" | "CUSTOMER_SOCIAL_SIGNUP" | "ACCOUNT_PHONE";

type VerificationConfig = {
  required: boolean;
  configured: boolean;
  codeLength: number;
  expiresMinutes: number;
};

export function CustomerPhoneVerification({
  phone,
  purpose,
  onVerificationChange,
  onRequiredChange,
}: {
  phone: string;
  purpose: VerificationPurpose;
  onVerificationChange: (token: string | null) => void;
  onRequiredChange?: (required: boolean) => void;
}) {
  const callbackRef = useRef(onVerificationChange);
  const requirementCallbackRef = useRef(onRequiredChange);
  const [config, setConfig] = useState<VerificationConfig | null | undefined>(undefined);
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { callbackRef.current = onVerificationChange; }, [onVerificationChange]);
  useEffect(() => { requirementCallbackRef.current = onRequiredChange; }, [onRequiredChange]);

  useEffect(() => {
    let active = true;
    fetch(`/api/customer-auth/phone-verification?purpose=${encodeURIComponent(purpose)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        const nextConfig = payload as VerificationConfig;
        setConfig(nextConfig);
        requirementCallbackRef.current?.(nextConfig.required);
      })
      .catch(() => { if (active) setConfig(null); });
    return () => { active = false; };
  }, [purpose]);

  async function requestCode() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/customer-auth/phone-verification/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Chưa thể gửi mã xác minh.");
      if (payload.verified === true) {
        setVerified(true);
        callbackRef.current("verified");
        setMessage(payload.message ?? "Số điện thoại đã được xác minh.");
        return;
      }
      setChallengeId(payload.challengeId);
      setMessage(payload.message ?? "Mã xác minh đã được gửi.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chưa thể gửi mã xác minh.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/customer-auth/phone-verification/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose, challengeId, code }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Mã xác minh chưa đúng.");
      setVerified(true);
      setMessage(payload.message ?? "Số điện thoại đã được xác minh.");
      callbackRef.current(payload.verificationToken ?? "verified");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Mã xác minh chưa đúng.");
    } finally {
      setBusy(false);
    }
  }

  if (config === undefined) {
    return <p className="flex items-center gap-2 rounded-xl bg-[#fff8f3] p-3 text-[11px] text-[#786a63]"><Loader2 size={13} className="animate-spin" /> Đang kiểm tra kênh xác minh...</p>;
  }
  if (!config?.required) return null;
  if (!config.configured) {
    return <p role="alert" className="rounded-xl bg-amber-50 p-3 text-[11px] leading-5 text-amber-900 ring-1 ring-amber-200">Kênh SMS đang được hoàn thiện. Bạn vẫn có thể đặt lịch không cần tài khoản; quyền lợi thành viên sẽ mở khi kênh xác minh sẵn sàng.</p>;
  }
  if (verified) {
    return <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-700 ring-1 ring-amber-200"><CheckCircle2 size={16} /> Đã xác minh số điện thoại</p>;
  }

  return (
    <div className="rounded-2xl bg-[#fff8f3] p-3 ring-1 ring-[#eadbd1]">
      <div className="flex items-start gap-2.5">
        <MessageSquareText size={17} className="mt-0.5 shrink-0 text-[#d13f1f]" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">Xác minh số để nhận quyền lợi thành viên</p>
          <p className="mt-1 text-[11px] leading-5 text-[#786a63]">Chỉ thực hiện một lần. Mã gồm {config.codeLength} số và có hiệu lực {config.expiresMinutes} phút.</p>
        </div>
      </div>
      {challengeId ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] leading-5 text-[#665b55]">{message}</p>
          <div className="flex gap-2">
            <input
              aria-label={`Mã xác minh ${config.codeLength} số`}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern={`[0-9]{${config.codeLength}}`}
              maxLength={config.codeLength}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              className="min-w-0 flex-1 rounded-xl border border-[#eadbd1] bg-white px-3 py-2.5 text-center font-mono text-lg tracking-[0.25em] outline-none focus:border-[#d13f1f]"
            />
            <button type="button" disabled={busy || code.length !== config.codeLength} onClick={() => void verifyCode()} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#d13f1f] px-4 text-xs font-semibold text-white disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Xác nhận
            </button>
          </div>
          <button type="button" disabled={busy} onClick={() => void requestCode()} className="text-[11px] font-semibold text-[#d13f1f] disabled:opacity-50">Gửi lại mã</button>
        </div>
      ) : (
        <button type="button" disabled={busy || phone.trim().length < 9} onClick={() => void requestCode()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#6f2821] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <MessageSquareText size={14} />} Gửi mã SMS
        </button>
      )}
      {error ? <p role="alert" className="mt-2 text-[11px] leading-5 text-red-700">{error}</p> : null}
    </div>
  );
}
