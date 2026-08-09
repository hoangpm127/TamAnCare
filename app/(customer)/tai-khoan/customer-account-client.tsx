"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Gift, Loader2, LockKeyhole, LogOut, Phone, ShieldCheck, UserRound } from "lucide-react";
import { DEFAULT_CUSTOMER_PROFILE, refreshCustomerProfile } from "@/lib/customer-profile-store";
import { customerPinError, normalizeCustomerPin } from "@/lib/customer-pin";
import { formatMoney } from "@/lib/utils";
import { signalCustomerAccountChanged, type CustomerAccountView } from "@/lib/customer-account";

export function CustomerAccountClient({
  returnTo = "/tai-khoan",
}: {
  returnTo?: string;
}) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [account, setAccount] = useState<CustomerAccountView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState(DEFAULT_CUSTOMER_PROFILE.fullName);
  const [phone, setPhone] = useState(DEFAULT_CUSTOMER_PROFILE.phone);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [acceptRequired, setAcceptRequired] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [marketingSaved, setMarketingSaved] = useState<boolean | null>(null);
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentMessage, setConsentMessage] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinMessage, setPinMessage] = useState("");

  useEffect(() => {
    fetch("/api/customer-auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setAccount(data.account ?? null))
      .finally(() => setLoading(false));
  }, []);

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
    if (mode === "register") {
      const pinError = customerPinError(pin, phone);
      if (pinError) {
        setError(pinError);
        return;
      }
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/customer-auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register"
          ? { fullName, phone, pin, acceptTerms: acceptRequired, acceptPrivacy: acceptRequired, marketingOptIn }
          : { phone, pin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể hoàn tất yêu cầu.");
      setAccount(data.account);
      setPin("");
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
    setPin("");
    setShowPin(false);
    setError("");
  }

  async function savePin(event: React.FormEvent) {
    event.preventDefault();
    if (!account) return;
    const validationError = customerPinError(pin, account.phone);
    if (validationError) {
      setPinMessage(validationError);
      return;
    }
    setPinSaving(true);
    setPinMessage("");
    try {
      const response = await fetch("/api/customer-auth/pin", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Chưa thể lưu Mã PIN Tâm An.");
      setAccount((current) => current ? { ...current, pinConfigured: true } : current);
      setPin("");
      setPinMessage("Đã lưu Mã PIN Tâm An.");
    } catch (caught) {
      setPinMessage(caught instanceof Error ? caught.message : "Chưa thể lưu Mã PIN Tâm An.");
    } finally {
      setPinSaving(false);
    }
  }

  if (loading) {
    return <main className="flex min-h-[60vh] items-center justify-center bg-[#fdf8f3]"><Loader2 className="animate-spin text-[#c64b32]" /></main>;
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
          <div className="mb-5 rounded-2xl bg-[#fff7df] p-4 ring-1 ring-[#c59a3d]/35">
            <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#6f211f]"><LockKeyhole size={17} /></span><div><h2 className="text-sm font-semibold">Mã PIN Tâm An</h2><p className="mt-1 text-xs leading-5 text-[#715943]">Mã riêng bảo vệ hồ sơ, ưu đãi và thu nhập Affiliate của bạn.</p></div></div>
            {!account.pinConfigured ? <form onSubmit={savePin} className="mt-3"><p className="mb-2 text-[11px] font-medium text-[#6f211f]">Hồ sơ cũ chưa có Mã PIN. Hãy tạo 4 số để đăng nhập lại khi cần.</p><PinInput pin={pin} showPin={showPin} setPin={setPin} setShowPin={setShowPin} /><button disabled={pinSaving || pin.length !== 4} className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#6f211f] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{pinSaving ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />} Lưu Mã PIN</button></form> : <p className="mt-3 rounded-xl bg-white/70 p-3 text-[11px] leading-5 text-[#68574f]">Mã PIN đã được thiết lập. Không chia sẻ mã cho người khác; nếu quên, hãy đến lễ tân để được đối chiếu và cấp mã mới.</p>}
            {pinMessage ? <p className="mt-2 text-[11px] font-semibold text-[#6f211f]">{pinMessage}</p> : null}
          </div>
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
          <div className="grid grid-cols-2 rounded-full bg-[#f6eee8] p-1">
            <button type="button" onClick={() => selectMode("register")} className={`rounded-full py-2.5 text-sm font-semibold ${mode === "register" ? "bg-white text-[#c64b32] shadow-sm" : "text-[#68574f]"}`}>Tạo tài khoản</button>
            <button type="button" onClick={() => selectMode("login")} className={`rounded-full py-2.5 text-sm font-semibold ${mode === "login" ? "bg-white text-[#c64b32] shadow-sm" : "text-[#68574f]"}`}>Đăng nhập</button>
          </div>
          <form onSubmit={submit} className="mt-4 space-y-3">
            {mode === "register" ? <label className="block text-xs font-semibold">Họ tên<span className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#e7d6ca] px-3"><UserRound size={15} className="text-[#c64b32]" /><input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="min-w-0 flex-1 py-3 text-sm outline-none" /></span></label> : null}
            <label className="block text-xs font-semibold">Số điện thoại<span className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#e7d6ca] px-3"><Phone size={15} className="text-[#c64b32]" /><input required inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="min-w-0 flex-1 py-3 text-sm outline-none" /></span></label>
            <label className="block text-xs font-semibold">Mã PIN Tâm An · 4 số<PinInput pin={pin} showPin={showPin} setPin={setPin} setShowPin={setShowPin} /><span className="mt-1.5 block text-[11px] font-normal leading-5 text-[#786a63]">Mã riêng để mở hồ sơ, ưu đãi và thu nhập Affiliate. Hãy chọn 4 số dễ nhớ với riêng bạn; tránh 0000, 1234, ngày sinh và 4 số cuối điện thoại.</span></label>
            {mode === "register" ? (
              <>
              <div className="rounded-2xl bg-[#fff7df] p-3 text-[11px] leading-5 text-[#715943] ring-1 ring-[#c59a3d]/35">
                <p className="font-semibold text-[#6f211f]">Không cần mã SMS hay mật khẩu dài.</p>
                <p className="mt-1">Chỉ cần nhớ Mã PIN Tâm An 4 số. Phiên đăng nhập tự gia hạn khi bạn còn sử dụng webapp; nếu quên mã, lễ tân sẽ hỗ trợ sau khi đối chiếu trực tiếp tại cơ sở.</p>
              </div>
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
            <button disabled={submitting || pin.length !== 4 || (mode === "register" && !acceptRequired)} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#c64b32] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{submitting ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}{mode === "register" ? "Tạo tài khoản & nhận 150K" : "Đăng nhập"}</button>
          </form>
          {mode === "login" ? (
            <Link href="/lien-he" className="mt-3 block w-full text-center text-xs font-semibold text-[#c64b32]">Quên Mã PIN? Hãy đến lễ tân để được cấp mã mới</Link>
          ) : null}
          <p className="mt-3 text-center text-[11px] leading-5 text-[#826f66]">Không bắt buộc tạo tài khoản để đặt lịch.</p>
        </div>
      </section>
    </main>
  );
}

function PinInput({ pin, showPin, setPin, setShowPin }: { pin: string; showPin: boolean; setPin: (value: string) => void; setShowPin: (value: boolean | ((current: boolean) => boolean)) => void }) {
  return <span className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#e7d6ca] bg-white px-3"><LockKeyhole size={15} className="shrink-0 text-[#c64b32]" /><input required aria-label="Mã PIN Tâm An 4 số" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} autoComplete="current-password" type={showPin ? "text" : "password"} value={pin} onChange={(event) => setPin(normalizeCustomerPin(event.target.value))} className="min-w-0 flex-1 py-3 text-center font-mono text-lg tracking-[0.35em] outline-none" /><button type="button" onClick={() => setShowPin((current) => !current)} aria-label={showPin ? "Ẩn Mã PIN" : "Hiện Mã PIN"} aria-pressed={showPin} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#786a63] hover:bg-[#f8ebe5] hover:text-[#c64b32]">{showPin ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>;
}
