"use client";

import Link from "next/link";
import { useState } from "react";
import QRCode from "qrcode";
import { BadgePercent, Check, ChevronDown, Copy, Download, Gift, Link2, Loader2, QrCode as QrCodeIcon, Save, Share2, ShieldCheck, Sparkles, TrendingUp, UserCheck } from "lucide-react";
import { referralTiers } from "@/lib/demo-data";
import { useReferralSummary } from "@/lib/referral-store";
import { translateCustomerText } from "@/lib/customer-i18n";
import { useCustomerLanguage } from "@/components/customer-language-provider";
import { cn, formatMoney } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Đã hoàn thành",
  PENDING: "Đang chờ",
};

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-[#fff4e6] text-[#a85f29]",
  PENDING: "bg-[#f3efec] text-[#826f66]",
};

function currentReferralTier(totalEarned: number) {
  let tier = referralTiers[0];
  for (const item of referralTiers) {
    if (totalEarned >= item.threshold) tier = item;
  }
  return tier;
}

export default function ReferralPage() {
  const { language } = useCustomerLanguage();
  const referral = useReferralSummary();
  const [copiedTarget, setCopiedTarget] = useState<"code" | "link" | null>(null);
  const [shareKitOpen, setShareKitOpen] = useState(false);
  const [referralLink, setReferralLink] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [profileDraft, setProfileDraft] = useState<NonNullable<typeof referral.profile> | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const affiliateProfile = profileDraft ?? referral.profile ?? {
    affiliateArea: "",
    affiliateBankName: "",
    affiliateBankAccount: "",
    affiliateBankHolder: "",
  };

  const referralPath = `/r/${referral.code}`;
  const shareText = translateCustomerText(
    "Mình gửi bạn lời mời Tâm An Center: cài webapp để nhận thêm 50K và cộng cùng quyền lợi thành viên mới 150K cho lần trải nghiệm đầu tiên đủ điều kiện.",
    language,
  );

  const invitedCount = referral.invited.length;
  const completedCount = referral.invited.filter((friend) => friend.status === "COMPLETED").length;
  const conversionRate = invitedCount ? Math.round((completedCount / invitedCount) * 100) : 0;

  const tier = currentReferralTier(referral.totalEarned);
  const tierIndex = referralTiers.indexOf(tier);
  const nextTier = referralTiers[tierIndex + 1];
  const tierProgress = nextTier ? Math.min(100, Math.round((referral.totalEarned / nextTier.threshold) * 100)) : 100;
  const maxMonthly = Math.max(...referral.monthlyEarnings.map((item) => item.amount), 1);

  if (!referral.ready) {
    return <main className="flex min-h-[60vh] items-center justify-center bg-[#fdf8f3]"><Loader2 className="animate-spin text-[#c64b32]" /></main>;
  }

  if (!referral.authenticated) {
    return (
      <main className="mx-auto max-w-xl px-4 py-8 text-[#281b18] sm:px-6">
        <section className="rounded-3xl bg-white p-6 text-center shadow-xl ring-1 ring-[#e7d6ca]">
          <BadgePercent className="mx-auto text-[#c64b32]" size={34} />
          <h1 className="mt-3 text-xl font-semibold">Đăng nhập để mở Affiliate</h1>
          <p className="mt-2 text-sm leading-6 text-[#68574f]">Mỗi tài khoản có một mã riêng để chia sẻ, theo dõi khách đủ điều kiện và nhận hoa hồng minh bạch.</p>
          <Link href="/tai-khoan?returnTo=%2Fru-ban" className="mt-5 inline-flex rounded-full bg-[#c64b32] px-5 py-3 text-sm font-semibold text-white">Đăng nhập hoặc tạo tài khoản</Link>
        </section>
      </main>
    );
  }

  if (referral.activationRequired) {
    return (
      <main className="mx-auto max-w-xl px-4 py-8 text-[#281b18] sm:px-6">
        <section className="rounded-3xl bg-white p-6 text-center shadow-xl ring-1 ring-[#e7d6ca]">
          <ShieldCheck className="mx-auto text-[#c64b32]" size={34} />
          <h1 className="mt-3 text-xl font-semibold">Xác minh một lần để kích hoạt Affiliate</h1>
          <p className="mt-2 text-sm leading-6 text-[#68574f]">Xác minh số điện thoại giúp mã giới thiệu gắn đúng người nhận hoa hồng. Sau đó bạn có thể chia sẻ link hoặc QR không giới hạn lượt.</p>
          <Link href="/tai-khoan?returnTo=%2Fru-ban" className="mt-5 inline-flex rounded-full bg-[#c64b32] px-5 py-3 text-sm font-semibold text-white">Xác minh số điện thoại</Link>
        </section>
      </main>
    );
  }

  if (!referral.code) {
    return (
      <main className="mx-auto max-w-xl px-4 py-8 text-[#281b18] sm:px-6">
        <section className="rounded-3xl bg-white p-6 text-center shadow-xl ring-1 ring-[#e7d6ca]">
          <BadgePercent className="mx-auto text-[#c64b32]" size={34} />
          <h1 className="mt-3 text-xl font-semibold">Mã Affiliate đang được khởi tạo</h1>
          <p className="mt-2 text-sm leading-6 text-[#68574f]">Tài khoản đã sẵn sàng nhưng chưa có mã chia sẻ. Vui lòng thử tải lại sau hoặc liên hệ bộ phận hỗ trợ.</p>
        </section>
      </main>
    );
  }

  async function copyCode() {
    await navigator.clipboard.writeText(referral.code);
    setCopiedTarget("code");
    setTimeout(() => setCopiedTarget(null), 1500);
  }

  async function share() {
    const link = referralLink || `${window.location.origin}${referralPath}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Tâm An Center", text: shareText, url: link });
        return;
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(`${shareText} ${link}`);
    setCopiedTarget("link");
    setTimeout(() => setCopiedTarget(null), 1500);
  }

  async function toggleShareKit() {
    const nextOpen = !shareKitOpen;
    setShareKitOpen(nextOpen);
    if (!nextOpen) return;
    const link = `${window.location.origin}${referralPath}`;
    setReferralLink(link);
    if (!qrDataUrl) {
      setQrLoading(true);
      try {
        const dataUrl = await QRCode.toDataURL(link, { margin: 1, width: 360, errorCorrectionLevel: "M", color: { dark: "#281b18", light: "#ffffff" } });
        setQrDataUrl(dataUrl);
      } finally {
        setQrLoading(false);
      }
    }
  }

  async function copyReferralLink() {
    const link = referralLink || `${window.location.origin}${referralPath}`;
    await navigator.clipboard.writeText(link);
    setCopiedTarget("link");
    setTimeout(() => setCopiedTarget(null), 1500);
  }

  async function saveAffiliateProfile() {
    setProfileSaving(true);
    setProfileMessage("");
    const response = await fetch("/api/referrals/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(affiliateProfile),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setProfileSaving(false);
    setProfileMessage(response.ok ? "Đã lưu hồ sơ nhận đối soát Affiliate." : payload.error ?? "Chưa thể lưu hồ sơ.");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-6 pt-3 text-[#281b18] sm:px-6">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5c3a1e] text-[#e7c878]"><BadgePercent size={20} /></span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Affiliate Tâm An</h1>
          <p className="mt-0.5 text-xs leading-5 text-[#826f66]">Theo dõi mã giới thiệu, đơn phát sinh và thu nhập Affiliate một tầng.</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-[#e7d6ca] bg-gradient-to-br from-[#231514] to-[#3d1f12] text-white shadow-lg">
        <div className="p-5 sm:p-6">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#c59a3d]">
            <Sparkles size={14} /> Báo cáo thu nhập
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{formatMoney(referral.totalEarned)}</p>
          <p className="mt-1 text-xs text-white/70">Tổng thưởng đã nhận từ giới thiệu bạn bè</p>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-white/80">
              <span>
                {tier.icon} {tier.name}
              </span>
              <span>{nextTier ? `${nextTier.icon} ${nextTier.name}` : "Hạng cao nhất"}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-[#c59a3d]" style={{ width: `${tierProgress}%` }} />
            </div>
            {nextTier ? (
              <p className="mt-1.5 text-[11px] text-white/70">
                Kiếm thêm <strong className="text-white">{formatMoney(nextTier.threshold - referral.totalEarned)}</strong> để lên hạng{" "}
                {nextTier.name}.
              </p>
            ) : null}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-4 text-center">
            <div>
              <p className="text-lg font-bold">{invitedCount}</p>
              <p className="mt-0.5 text-[11px] text-white/70">Đã mời</p>
            </div>
            <div>
              <p className="text-lg font-bold">{completedCount}</p>
              <p className="mt-0.5 text-[11px] text-white/70">Thành công</p>
            </div>
            <div>
              <p className="text-lg font-bold">{conversionRate}%</p>
              <p className="mt-0.5 text-[11px] text-white/70">Tỷ lệ chốt</p>
            </div>
          </div>

          <div className="mt-5 border-t border-white/15 pt-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
              <TrendingUp size={13} /> Thu nhập theo tháng
            </p>
            <div className="mt-3 flex items-end justify-between gap-2">
              {referral.monthlyEarnings.map((item) => (
                <div key={item.month} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-16 w-full items-end">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-[#c59a3d] to-[#f4dba0]"
                      style={{ height: `${Math.max(6, Math.round((item.amount / maxMonthly) * 100))}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-white/70">{item.month}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-[#e7d6ca] bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="text-sm font-semibold">Hồ sơ nhận đối soát</h2><p className="mt-1 text-[11px] leading-4 text-[#826f66]">Dùng cho kỳ chuyển khoản 15 ngày; khách được giới thiệu không nhìn thấy thông tin này.</p></div>
          <ShieldCheck className="shrink-0 text-[#c64b32]" size={20} />
        </div>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <input value={affiliateProfile.affiliateArea ?? ""} onChange={(event) => setProfileDraft({ ...affiliateProfile, affiliateArea: event.target.value })} placeholder="Khu vực/mã vùng" className="rounded-xl border border-[#e7d6ca] px-3 py-2.5 text-sm" />
          <input value={affiliateProfile.affiliateBankName ?? ""} onChange={(event) => setProfileDraft({ ...affiliateProfile, affiliateBankName: event.target.value })} placeholder="Ngân hàng nhận" className="rounded-xl border border-[#e7d6ca] px-3 py-2.5 text-sm" />
          <input inputMode="numeric" value={affiliateProfile.affiliateBankAccount ?? ""} onChange={(event) => setProfileDraft({ ...affiliateProfile, affiliateBankAccount: event.target.value.replace(/\D/g, "") })} placeholder="Số tài khoản" className="rounded-xl border border-[#e7d6ca] px-3 py-2.5 text-sm" />
          <input value={affiliateProfile.affiliateBankHolder ?? ""} onChange={(event) => setProfileDraft({ ...affiliateProfile, affiliateBankHolder: event.target.value })} placeholder="Tên chủ tài khoản" className="rounded-xl border border-[#e7d6ca] px-3 py-2.5 text-sm" />
        </div>
        <button type="button" disabled={profileSaving} onClick={() => void saveAffiliateProfile()} className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#c64b32] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-60">{profileSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu hồ sơ</button>
        {profileMessage ? <p className="mt-2 text-xs text-[#68574f]">{profileMessage}</p> : null}
      </section>

      <section className="mt-4 rounded-xl border border-[#e7d6ca] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#c64b32]">Mã giới thiệu của bạn</p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f8ebe5] px-2 py-0.5 text-[10px] font-semibold text-[#c64b32]">
            {tier.icon} {tier.name}
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex flex-1 items-center justify-between gap-2 rounded-xl bg-[#fcf3ed] px-3 py-2.5">
            <span className="truncate text-base font-bold tracking-wide text-[#281b18]">{referral.code}</span>
            <button
              type="button"
              onClick={copyCode}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition",
                copiedTarget === "code" ? "bg-[#a85f29] text-white" : "bg-[#c64b32] text-white"
              )}
              aria-label="Chép mã"
            >
              {copiedTarget === "code" ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void toggleShareKit()}
          aria-expanded={shareKitOpen}
          className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-[#b6403a] to-[#8b2b28] px-4 py-3.5 text-left text-white shadow-md shadow-[#8b2b28]/15"
        >
          <span className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"><Share2 size={17} /></span>
            <span><strong className="block text-sm">Chia sẻ link giới thiệu</strong><small className="mt-0.5 block text-[10px] text-white/75">Link và mã QR dùng chung một nguồn ghi nhận</small></span>
          </span>
          <ChevronDown size={18} className={cn("shrink-0 transition-transform", shareKitOpen && "rotate-180")} />
        </button>

        {shareKitOpen ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-[#e7d6ca] bg-[#fdf8f5]">
            <div className="grid gap-4 p-4 sm:grid-cols-[168px_1fr] sm:items-center">
              <div className="mx-auto flex h-[168px] w-[168px] items-center justify-center rounded-2xl bg-white p-2 shadow-sm ring-1 ring-[#e7d6ca]">
                {qrLoading ? (
                  <Loader2 size={26} className="animate-spin text-[#c64b32]" />
                ) : qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="Mã QR giới thiệu" className="h-full w-full" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><QrCodeIcon size={16} className="text-[#c64b32]" /> Mã QR giới thiệu</p>
                <p className="mt-1 text-[11px] leading-4 text-[#826f66]">Người nhận quét QR hoặc bấm link đều mở cùng một lời mời và được lưu mã trong 30 ngày.</p>
                <div className="mt-2.5 flex min-w-0 items-center gap-2 rounded-xl bg-white px-3 py-2.5 ring-1 ring-[#e7d6ca]">
                  <Link2 size={14} className="shrink-0 text-[#c64b32]" />
                  <span className="min-w-0 flex-1 truncate text-[10px] text-[#51423b]">{referralLink || referralPath}</span>
                </div>
              </div>
            </div>
            <div className="grid gap-2 border-t border-[#e7d6ca] bg-white p-3 sm:grid-cols-3">
              <button type="button" onClick={() => void share()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c64b32] px-3 py-3 text-xs font-semibold text-white"><Share2 size={15} /> Chia sẻ link giới thiệu</button>
              <button type="button" onClick={() => void copyReferralLink()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e7d6ca] px-3 py-3 text-xs font-semibold text-[#6f211f]">{copiedTarget === "link" ? <Check size={15} /> : <Copy size={15} />} Sao chép link để mở bằng trình duyệt</button>
              {qrDataUrl ? <a href={qrDataUrl} download={`TAM-AN-AFF-${referral.code}.png`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e7d6ca] px-3 py-3 text-xs font-semibold text-[#6f211f]"><Download size={15} /> Tải QR</a> : <span className="inline-flex items-center justify-center rounded-xl border border-[#e7d6ca] px-3 py-3 text-xs text-[#826f66]">Đang tạo mã…</span>}
            </div>
          </div>
        ) : null}

        <p className="mt-2.5 text-[11px] leading-4 text-[#826f66]">
          Chia sẻ link hoặc mã QR — ai đặt lịch qua đây đều được tự động ghi nhận Affiliate 1 tầng cho bạn.
        </p>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-2.5 rounded-xl border border-[#e7d6ca] bg-white p-3.5">
          <Gift className="mt-0.5 shrink-0 text-[#c64b32]" size={18} />
          <div>
            <p className="text-sm font-semibold">Bạn nhận</p>
            <p className="mt-0.5 text-xs leading-5 text-[#68574f]">{referral.rewardForYou}</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl border border-[#e7d6ca] bg-white p-3.5">
          <Gift className="mt-0.5 shrink-0 text-[#c64b32]" size={18} />
          <div>
            <p className="text-sm font-semibold">Bạn bè nhận</p>
            <p className="mt-0.5 text-xs leading-5 text-[#68574f]">{referral.rewardForFriend}</p>
          </div>
        </div>
      </section>
      <p className="mt-2 rounded-xl bg-[#fff7df] px-3.5 py-3 text-[11px] leading-5 text-[#715943] ring-1 ring-[#c59a3d]/35">Khách phải cài và mở webapp để khóa nguồn giới thiệu. Bạn chỉ được ghi nhận hoa hồng sau khi dịch vụ hoàn tất và Bill còn lại đã thanh toán đủ; tip không tham gia phép tính.</p>

      <section className="mt-5">
        <div className="mb-2.5 flex items-end justify-between gap-4">
          <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
            <UserCheck size={16} className="text-[#c64b32]" /> Bạn bè đã mời
          </h2>
          <p className="text-sm font-semibold text-[#c64b32]">Đã nhận {formatMoney(referral.totalEarned)}</p>
        </div>
        <div className="overflow-hidden rounded-xl border border-[#e7d6ca] bg-white">
          {referral.invited.map((friend) => (
            <div key={friend.name} className="flex items-center justify-between gap-3 border-b border-[#eee0d6] px-4 py-2.5 last:border-b-0">
              <div className="min-w-0">
                <p className="text-sm font-medium">{friend.name}</p>
                <p className="text-[11px] text-[#826f66]">{friend.joinedAt}</p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLE[friend.status])}>
                  {STATUS_LABEL[friend.status]}
                </span>
                <span className="shrink-0 whitespace-nowrap text-right text-sm font-semibold">
                  {friend.reward > 0 ? `+${formatMoney(friend.reward)}` : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
