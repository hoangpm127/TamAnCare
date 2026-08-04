"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Gift, Loader2, LockKeyhole, LogOut, Phone, ShieldCheck, UserRound } from "lucide-react";
import { DEFAULT_CUSTOMER_PROFILE, refreshCustomerProfile } from "@/lib/customer-profile-store";
import { formatMoney } from "@/lib/utils";
import { signalCustomerAccountChanged, type CustomerAccountView } from "@/lib/customer-account";
import { CustomerPasswordRecovery } from "@/components/customer-password-recovery";
import { CustomerPhoneVerification } from "@/components/customer-phone-verification";
import { CustomerSocialAuthButtons, CustomerSocialCompletion } from "@/components/customer-social-auth";

export function CustomerAccountClient({
  initialOauthCompletion = false,
  initialOauthMessage = "",
  cleanOauthQuery = false,
  availableSocialProviders = ["google"],
  oauthProvider = "google",
  returnTo = "/tai-khoan",
}: {
  initialOauthCompletion?: boolean;
  initialOauthMessage?: string;
  cleanOauthQuery?: boolean;
  availableSocialProviders?: Array<"google" | "facebook">;
  oauthProvider?: "google" | "facebook";
  returnTo?: string;
}) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [account, setAccount] = useState<CustomerAccountView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState(DEFAULT_CUSTOMER_PROFILE.fullName);
  const [phone, setPhone] = useState(DEFAULT_CUSTOMER_PROFILE.phone);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [acceptRequired, setAcceptRequired] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [phoneVerificationToken, setPhoneVerificationToken] = useState<string | null>(null);
  const [phoneVerificationRequired, setPhoneVerificationRequired] = useState(false);
  const [marketingSaved, setMarketingSaved] = useState<boolean | null>(null);
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentMessage, setConsentMessage] = useState("");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [oauthCompletionOpen, setOauthCompletionOpen] = useState(initialOauthCompletion);
  const [oauthMessage] = useState(initialOauthMessage);

  useEffect(() => {
    fetch("/api/customer-auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setAccount(data.account ?? null))
      .finally(() => setLoading(false));
    if (cleanOauthQuery && !initialOauthCompletion) window.history.replaceState({}, "", window.location.pathname);
  }, [cleanOauthQuery, initialOauthCompletion]);

  function clearOauthQuery() {
    window.history.replaceState({}, "", window.location.pathname);
  }

  useEffect(() => {
    if (!account) return;
    let active = true;
    fetch("/api/customer-consents", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (active && typeof data.marketingOptIn === "boolean") setMarketingSaved(data.marketingOptIn);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [account]);

  async function updateMarketing(nextValue: boolean) {
    setConsentSaving(true);
    setConsentMessage("");
    try {
      const response = await fetch("/api/customer-consents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketingOptIn: nextValue }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể cập nhật lựa chọn riêng tư.");
      setMarketingSaved(Boolean(data.marketingOptIn));
      setConsentMessage("Đã lưu lựa chọn và ghi nhận thời điểm cập nhật.");
    } catch (caught) {
      setConsentMessage(caught instanceof Error ? caught.message : "Không thể cập nhật lựa chọn riêng tư.");
    } finally {
      setConsentSaving(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "register" && password !== passwordConfirmation) {
      setError("Hai mật khẩu chưa trùng khớp.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/customer-auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register"
          ? { fullName, phone, password, passwordConfirmation, phoneVerificationToken, acceptTerms: acceptRequired, acceptPrivacy: acceptRequired, marketingOptIn }
          : { phone, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể hoàn tất yêu cầu.");
      setAccount(data.account);
      signalCustomerAccountChanged();
      void refreshCustomerProfile();
      if (returnTo !== "/tai-khoan") window.location.assign(returnTo);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể hoàn tất yêu cầu.");
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    await fetch("/api/customer-auth/session", { method: "DELETE" });
    setAccount(null);
    setMode("login");
  }

  function selectMode(nextMode: "register" | "login") {
    setMode(nextMode);
    setPassword("");
    setPasswordConfirmation("");
    setShowPassword(false);
    setShowPasswordConfirmation(false);
    setPhoneVerificationToken(null);
    setError("");
    if (nextMode === "register") setRecoveryOpen(false);
  }

  if (loading) {
    return <main className="flex min-h-[60vh] items-center justify-center bg-[#fdf8f3]"><Loader2 className="animate-spin text-[#c64b32]" /></main>;
  }

  if (oauthCompletionOpen && !account) {
    return <CustomerSocialCompletion provider={oauthProvider} returnTo={returnTo} onComplete={(nextAccount) => { setAccount(nextAccount); signalCustomerAccountChanged(); setOauthCompletionOpen(false); void refreshCustomerProfile(); if (returnTo !== "/tai-khoan") window.location.assign(returnTo); else clearOauthQuery(); }} onCancel={() => { setOauthCompletionOpen(false); clearOauthQuery(); }} />;
  }

  if (account) {
    return (
      <main className="mx-auto max-w-xl px-4 py-6 text-[#281b18] sm:px-6">
        <section className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-[#e7d6ca]">
          <div className="bg-gradient-to-br from-[#2b1815] via-[#5c2718] to-[#93352d] p-6 text-center text-white">
            <CheckCircle2 className="mx-auto text-[#e7c878]" size={36} />
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-[#e7c878]">Thành viên Tâm An Center</p>
            <h1 className="mt-1 text-xl font-semibold">Xin chào {account.fullName}</h1>
            <p className="mt-1 text-xs text-white/70">{account.phone}</p>
          </div>
          <div className="p-5">
            {oauthMessage ? <p className="mb-4 rounded-2xl bg-amber-50 p-3 text-center text-xs font-semibold text-amber-700">{oauthMessage}</p> : null}
            {!account.phoneVerified ? (
              <div className="mb-4">
                <CustomerPhoneVerification
                  key={`account:${account.phone}`}
                  phone={account.phone}
                  purpose="ACCOUNT_PHONE"
                  onVerificationChange={(token) => {
                    if (token) setAccount((current) => current ? { ...current, phoneVerified: true } : current);
                  }}
                />
              </div>
            ) : null}
            <div className="rounded-2xl bg-[#fff7df] p-4 text-center ring-1 ring-[#c59a3d]/45">
              <Gift className="mx-auto text-[#c64b32]" size={24} />
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#76551d]">Ưu đãi đang có</p>
              <p className="mt-1 text-2xl font-bold text-[#c64b32]">{formatMoney(account.creditBalance)}</p>
              <p className="mt-1 text-xs leading-5 text-[#715943]">Hệ thống tự ưu tiên WELCOME150 cho lần đặt dịch vụ đầu tiên đủ điều kiện.</p>
            </div>
            <Link href="/booking" className="mt-4 flex w-full items-center justify-center rounded-full bg-[#c64b32] px-5 py-3 text-sm font-semibold text-white">Đặt lịch và dùng ưu đãi</Link>
            <button type="button" onClick={() => void logout()} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-[#e7d6ca] px-5 py-2.5 text-xs font-semibold text-[#68574f]"><LogOut size={14} /> Đăng xuất</button>
          </div>
        </section>
        <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#e7d6ca]">
          <div className="mb-5">
            <h2 className="text-sm font-semibold">Đăng nhập nhanh</h2>
            <p className="mt-1 mb-3 text-xs leading-5 text-[#786a63]">Liên kết để lần sau đăng nhập nhanh mà vẫn giữ nguyên lịch sử và ưu đãi.</p>
            <CustomerSocialAuthButtons availableProviders={availableSocialProviders} linkedProviders={account.oauthProviders ?? []} linkMode returnTo="/tai-khoan" />
          </div>
          <div className="mb-5 border-t border-[#eee1d8]" />
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f8ebe5] text-[#c64b32]"><ShieldCheck size={17} /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Quyền riêng tư và liên lạc</h2>
              <p className="mt-1 text-xs leading-5 text-[#786a63]">Ưu đãi tiếp thị là tùy chọn, không ảnh hưởng tài khoản hoặc booking.</p>
            </div>
          </div>
          <label className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-[#fcf5ef] p-3 text-xs font-medium text-[#554842] ring-1 ring-[#e7d6ca]">
            <span>Nhận ưu đãi và gợi ý chăm sóc</span>
            <input
              type="checkbox"
              disabled={consentSaving || marketingSaved === null}
              checked={Boolean(marketingSaved)}
              onChange={(event) => void updateMarketing(event.target.checked)}
              className="h-4 w-4 shrink-0 accent-[#c64b32] disabled:opacity-50"
            />
          </label>
          {consentMessage ? <p className="mt-2 text-[11px] leading-5 text-[#786a63]">{consentMessage}</p> : null}
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-[#c64b32]">
            <Link href="/chinh-sach-rieng-tu">Xem chính sách bảo vệ dữ liệu</Link>
            <Link href="/dieu-khoan">Xem điều khoản</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6 text-[#281b18] sm:px-6">
      <section className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-[#e7d6ca]">
        <div className="bg-gradient-to-br from-[#2b1815] via-[#5c2718] to-[#93352d] px-5 py-6 text-white">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-[#e7c878]"><Gift size={15} /> Thành viên mới</p>
          <h1 className="mt-2 text-2xl font-semibold">Tạo tài khoản, nhận ngay 150K</h1>
          <p className="mt-2 text-sm leading-6 text-white/75">Bạn vẫn có thể xem và đặt lịch không cần đăng nhập. Tài khoản chỉ giúp giữ ưu đãi, lịch sử và chăm sóc cá nhân hóa.</p>
        </div>
        <div className="p-5">
          {oauthMessage ? <p className="mb-4 rounded-2xl bg-amber-50 p-3 text-center text-xs font-semibold text-amber-800">{oauthMessage}</p> : null}
          <div className="grid grid-cols-2 rounded-full bg-[#f6eee8] p-1">
            <button type="button" onClick={() => selectMode("register")} className={`rounded-full py-2.5 text-sm font-semibold ${mode === "register" ? "bg-white text-[#c64b32] shadow-sm" : "text-[#68574f]"}`}>Tạo tài khoản</button>
            <button type="button" onClick={() => selectMode("login")} className={`rounded-full py-2.5 text-sm font-semibold ${mode === "login" ? "bg-white text-[#c64b32] shadow-sm" : "text-[#68574f]"}`}>Đăng nhập</button>
          </div>
          <div className="mt-4">
            <CustomerSocialAuthButtons availableProviders={availableSocialProviders} returnTo={returnTo} />
            <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9b8c84]"><span className="h-px flex-1 bg-[#e7d6ca]" /><span>Hoặc dùng số điện thoại</span><span className="h-px flex-1 bg-[#e7d6ca]" /></div>
          </div>
          <form onSubmit={submit} className="mt-4 space-y-3">
            {mode === "register" ? <label className="block text-xs font-semibold">Họ tên<span className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#e7d6ca] px-3"><UserRound size={15} className="text-[#c64b32]" /><input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="min-w-0 flex-1 py-3 text-sm outline-none" /></span></label> : null}
            <label className="block text-xs font-semibold">Số điện thoại<span className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#e7d6ca] px-3"><Phone size={15} className="text-[#c64b32]" /><input required inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setPhoneVerificationToken(null); }} className="min-w-0 flex-1 py-3 text-sm outline-none" /></span></label>
            <label className="block text-xs font-semibold">{mode === "register" ? "Mật khẩu từ 15 ký tự" : "Mật khẩu"}<span className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#e7d6ca] px-3"><LockKeyhole size={15} className="shrink-0 text-[#c64b32]" /><input required minLength={mode === "register" ? 15 : 6} maxLength={72} autoComplete={mode === "register" ? "new-password" : "current-password"} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="min-w-0 flex-1 py-3 text-sm outline-none" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={showPassword} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#786a63] hover:bg-[#f8ebe5] hover:text-[#c64b32]">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
            {mode === "register" ? (
              <>
              <label className="block text-xs font-semibold">Nhập lại mật khẩu<span className={`mt-1.5 flex items-center gap-2 rounded-xl border px-3 ${passwordConfirmation && passwordConfirmation !== password ? "border-red-300 bg-red-50/40" : "border-[#e7d6ca]"}`}><LockKeyhole size={15} className="shrink-0 text-[#c64b32]" /><input required minLength={15} maxLength={72} autoComplete="new-password" type={showPasswordConfirmation ? "text" : "password"} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} aria-invalid={Boolean(passwordConfirmation && passwordConfirmation !== password)} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" /><button type="button" onClick={() => setShowPasswordConfirmation((current) => !current)} aria-label={showPasswordConfirmation ? "Ẩn mật khẩu nhập lại" : "Hiện mật khẩu nhập lại"} aria-pressed={showPasswordConfirmation} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#786a63] hover:bg-[#f8ebe5] hover:text-[#c64b32]">{showPasswordConfirmation ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>{passwordConfirmation && passwordConfirmation !== password ? <span className="mt-1.5 block text-[11px] font-medium text-red-700">Hai mật khẩu chưa trùng khớp.</span> : null}</label>
              <CustomerPhoneVerification
                key={`signup:${phone}`}
                phone={phone}
                purpose="CUSTOMER_SIGNUP"
                onVerificationChange={setPhoneVerificationToken}
                onRequiredChange={setPhoneVerificationRequired}
              />
              <div className="space-y-2 rounded-2xl bg-[#fcf5ef] p-3 ring-1 ring-[#e7d6ca]">
                <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-[#554842]">
                  <input
                    required
                    type="checkbox"
                    checked={acceptRequired}
                    onChange={(event) => setAcceptRequired(event.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#c64b32]"
                  />
                  <span>
                    Tôi đã đọc và đồng ý với <Link href="/dieu-khoan" target="_blank" className="font-semibold text-[#c64b32] underline">Điều khoản sử dụng</Link> và{" "}
                    <Link href="/chinh-sach-rieng-tu" target="_blank" className="font-semibold text-[#c64b32] underline">Chính sách bảo vệ dữ liệu</Link>.
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-[#6f625c]">
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(event) => setMarketingOptIn(event.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#c64b32]"
                  />
                  <span>Nhận ưu đãi và gợi ý chăm sóc. Không bắt buộc và có thể rút lại sau.</span>
                </label>
              </div>
              </>
            ) : null}
            {error ? <p role="alert" aria-live="polite" className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p> : null}
            <button disabled={submitting || (mode === "register" && (password !== passwordConfirmation || (phoneVerificationRequired && !phoneVerificationToken)))} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#c64b32] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{submitting ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}{mode === "register" ? "Tạo tài khoản & nhận 150K" : "Đăng nhập"}</button>
          </form>
          {mode === "login" ? (
            recoveryOpen
              ? <CustomerPasswordRecovery initialPhone={phone} onClose={() => setRecoveryOpen(false)} />
              : <button type="button" onClick={() => setRecoveryOpen(true)} className="mt-3 w-full text-center text-xs font-semibold text-[#c64b32]">Quên mật khẩu?</button>
          ) : null}
          <p className="mt-3 text-center text-[11px] leading-5 text-[#826f66]">Không bắt buộc tạo tài khoản để đặt lịch.</p>
        </div>
      </section>
    </main>
  );
}
