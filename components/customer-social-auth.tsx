"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Phone, ShieldCheck, UserRound, X } from "lucide-react";
import type { CustomerAccountView } from "@/lib/customer-account";
import { CustomerPhoneVerification } from "@/components/customer-phone-verification";

type SocialProvider = "GOOGLE" | "FACEBOOK";

type PendingIdentity = {
  provider: SocialProvider;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

const providers = [
  { id: "GOOGLE" as const, slug: "google", label: "Google", mark: "G", markClass: "text-[#4285f4]" },
  { id: "FACEBOOK" as const, slug: "facebook", label: "Facebook", mark: "f", markClass: "bg-[#1877f2] text-white" },
];

export function CustomerSocialAuthButtons({
  availableProviders = ["google"],
  linkedProviders = [],
  linkMode = false,
  returnTo = "/tai-khoan",
}: {
  availableProviders?: Array<"google" | "facebook">;
  linkedProviders?: SocialProvider[];
  linkMode?: boolean;
  returnTo?: string;
}) {
  return (
    <div className={linkMode ? "grid gap-2 sm:grid-cols-2" : "grid gap-2"}>
      {providers.filter((provider) => availableProviders.includes(provider.slug as "google" | "facebook") || (linkMode && linkedProviders.includes(provider.id))).map((provider) => {
        const linked = linkedProviders.includes(provider.id);
        return linked ? (
          <div key={provider.id} className="flex items-center justify-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-700">
            <CheckCircle2 size={15} /> Đã liên kết {provider.label}
          </div>
        ) : (
          <a
            key={provider.id}
            href={`/api/customer-auth/oauth/${provider.slug}?returnTo=${encodeURIComponent(returnTo)}`}
            className="flex items-center justify-center gap-2 rounded-full border border-[#ddcfc6] bg-white px-4 py-2.5 text-sm font-semibold text-[#3f3733] transition hover:border-[#d13f1f] hover:bg-[#fff8f3]"
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-sm font-black ${provider.markClass}`}>{provider.mark}</span>
            {linkMode ? `Liên kết ${provider.label}` : `Tiếp tục với ${provider.label}`}
          </a>
        );
      })}
    </div>
  );
}

export function CustomerSocialCompletion({
  onComplete,
  onCancel,
  provider,
  returnTo,
}: {
  onComplete: (account: CustomerAccountView) => void;
  onCancel: () => void;
  provider: "google" | "facebook";
  returnTo: string;
}) {
  const [pending, setPending] = useState<PendingIdentity | null | undefined>(undefined);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneVerificationToken, setPhoneVerificationToken] = useState<string | null>(null);
  const [phoneVerificationRequired, setPhoneVerificationRequired] = useState(false);
  const [acceptRequired, setAcceptRequired] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadPending() {
      for (const delayMs of [0, 350, 850]) {
        if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
        try {
          const response = await fetch("/api/customer-auth/oauth/pending", { cache: "no-store", credentials: "same-origin" });
          if (!response.ok) continue;
          const data = await response.json();
          const nextPending = data.pending as PendingIdentity | null;
          if (!active) return;
          if (nextPending) {
            setPending(nextPending);
            setFullName(nextPending.displayName ?? "");
            return;
          }
        } catch {
          // Thử lại để tránh hiển thị hết hạn khi cookie vừa được ghi sau callback.
        }
      }
      if (active) setPending(null);
    }
    void loadPending();
    return () => { active = false; };
  }, []);

  async function cancel() {
    await fetch("/api/customer-auth/oauth/pending", { method: "DELETE" }).catch(() => undefined);
    onCancel();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/customer-auth/oauth/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          phoneVerificationToken,
          acceptTerms: acceptRequired,
          acceptPrivacy: acceptRequired,
          marketingOptIn,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể hoàn tất tài khoản.");
      onComplete(data.account);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể hoàn tất tài khoản.");
    } finally {
      setSubmitting(false);
    }
  }

  if (pending === undefined) {
    return <main className="flex min-h-[60vh] items-center justify-center bg-[#fffaf6]"><Loader2 className="animate-spin text-[#d13f1f]" /></main>;
  }

  if (!pending) {
    const providerLabel = provider === "google" ? "Google" : "Facebook";
    return (
      <main className="mx-auto max-w-xl px-4 py-6 text-[#191414] sm:px-6">
        <section className="rounded-3xl bg-white p-6 text-center shadow-xl ring-1 ring-[#eadbd1]">
          <ShieldCheck className="mx-auto text-[#d13f1f]" size={32} />
          <h1 className="mt-3 text-xl font-semibold">Phiên đăng nhập đã hết hạn</h1>
          <p className="mt-2 text-sm leading-6 text-[#786a63]">Phiên trước không còn hiệu lực. Bạn có thể bắt đầu lại ngay mà không cần nhập lại thông tin khác.</p>
          <a href={`/api/customer-auth/oauth/${provider}?returnTo=${encodeURIComponent(returnTo)}`} className="mt-4 block rounded-full bg-[#d13f1f] px-5 py-2.5 text-sm font-semibold text-white">Đăng nhập lại bằng {providerLabel}</a>
          <button type="button" onClick={onCancel} className="mt-2 rounded-full px-5 py-2 text-xs font-semibold text-[#786a63]">Chọn cách đăng nhập khác</button>
        </section>
      </main>
    );
  }

  const providerLabel = pending.provider === "GOOGLE" ? "Google" : "Facebook";
  return (
    <main className="mx-auto max-w-xl px-4 py-6 text-[#191414] sm:px-6">
      <section className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-[#eadbd1]">
        <div className="bg-gradient-to-br from-[#2b1815] via-[#5c2718] to-[#8f241d] px-5 py-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#f5d982]">Đã xác thực qua {providerLabel}</p>
              <h1 className="mt-2 text-2xl font-semibold">Hoàn tất tài khoản Tâm An Center</h1>
            </div>
            <button type="button" onClick={() => void cancel()} aria-label="Hủy đăng nhập mạng xã hội" className="rounded-full bg-white/10 p-2 text-white/80"><X size={18} /></button>
          </div>
          {pending.email ? <p className="mt-2 text-sm text-white/75">{pending.email}</p> : null}
        </div>
        <form onSubmit={submit} className="space-y-3 p-5">
          <p className="text-xs leading-5 text-[#786a63]">Số điện thoại giúp giữ đúng lịch sử booking, ưu đãi và chăm sóc tại hai cơ sở.</p>
          <label className="block text-xs font-semibold">Họ tên<span className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#eadbd1] px-3"><UserRound size={15} className="text-[#d13f1f]" /><input required minLength={2} maxLength={100} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} className="min-w-0 flex-1 py-3 text-sm outline-none" /></span></label>
          <label className="block text-xs font-semibold">Số điện thoại<span className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#eadbd1] px-3"><Phone size={15} className="text-[#d13f1f]" /><input required inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setPhoneVerificationToken(null); }} className="min-w-0 flex-1 py-3 text-sm outline-none" /></span></label>
          <CustomerPhoneVerification
            key={`social:${phone}`}
            phone={phone}
            purpose="CUSTOMER_SOCIAL_SIGNUP"
            onVerificationChange={setPhoneVerificationToken}
            onRequiredChange={setPhoneVerificationRequired}
          />
          <div className="space-y-2 rounded-2xl bg-[#fff8f3] p-3 ring-1 ring-[#eadbd1]">
            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-[#554842]">
              <input required type="checkbox" checked={acceptRequired} onChange={(event) => setAcceptRequired(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#d13f1f]" />
              <span>Tôi đã đọc và đồng ý với <Link href="/dieu-khoan" target="_blank" className="font-semibold text-[#d13f1f] underline">Điều khoản sử dụng</Link> và <Link href="/chinh-sach-rieng-tu" target="_blank" className="font-semibold text-[#d13f1f] underline">Chính sách bảo vệ dữ liệu</Link>.</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-[#6f625c]">
              <input type="checkbox" checked={marketingOptIn} onChange={(event) => setMarketingOptIn(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#d13f1f]" />
              <span>Nhận ưu đãi và gợi ý chăm sóc. Không bắt buộc và có thể rút lại sau.</span>
            </label>
          </div>
          {error ? <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p> : null}
          <button disabled={submitting || (phoneVerificationRequired && !phoneVerificationToken)} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#d13f1f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {submitting ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
            Hoàn tất &amp; nhận ưu đãi 100K
          </button>
        </form>
      </section>
    </main>
  );
}
