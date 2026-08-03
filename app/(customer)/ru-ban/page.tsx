"use client";

import Link from "next/link";
import { useState } from "react";
import QRCode from "qrcode";
import { BadgePercent, Check, Copy, Gift, Loader2, QrCode as QrCodeIcon, Share2, ShieldCheck, Sparkles, TrendingUp, UserCheck } from "lucide-react";
import { referralTiers } from "@/lib/demo-data";
import { useReferralSummary } from "@/lib/referral-store";
import { cn, formatMoney } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Đã hoàn thành",
  PENDING: "Đang chờ",
};

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-[#eafaf1] text-[#1d8f55]",
  PENDING: "bg-[#f3efec] text-[#8a7a72]",
};

function currentReferralTier(totalEarned: number) {
  let tier = referralTiers[0];
  for (const item of referralTiers) {
    if (totalEarned >= item.threshold) tier = item;
  }
  return tier;
}

export default function ReferralPage() {
  const referral = useReferralSummary();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const referralPath = `/r/${referral.code}`;
  const shareText = "Mình gửi bạn lời mời Tâm An Care: nhận ưu đãi cho lần trải nghiệm đầu tiên, đặt lịch ngay trên web và có thể cài lên màn hình điện thoại.";

  const invitedCount = referral.invited.length;
  const completedCount = referral.invited.filter((friend) => friend.status === "COMPLETED").length;
  const conversionRate = invitedCount ? Math.round((completedCount / invitedCount) * 100) : 0;

  const tier = currentReferralTier(referral.totalEarned);
  const tierIndex = referralTiers.indexOf(tier);
  const nextTier = referralTiers[tierIndex + 1];
  const tierProgress = nextTier ? Math.min(100, Math.round((referral.totalEarned / nextTier.threshold) * 100)) : 100;
  const maxMonthly = Math.max(...referral.monthlyEarnings.map((item) => item.amount), 1);

  if (!referral.ready) {
    return <main className="flex min-h-[60vh] items-center justify-center bg-[#fffaf6]"><Loader2 className="animate-spin text-[#9f1d20]" /></main>;
  }

  if (!referral.authenticated) {
    return (
      <main className="mx-auto max-w-xl px-4 py-8 text-[#191414] sm:px-6">
        <section className="rounded-3xl bg-white p-6 text-center shadow-xl ring-1 ring-[#eadbd1]">
          <BadgePercent className="mx-auto text-[#9f1d20]" size={34} />
          <h1 className="mt-3 text-xl font-semibold">Đăng nhập để mở Affiliate</h1>
          <p className="mt-2 text-sm leading-6 text-[#665b55]">Mỗi tài khoản có một mã riêng để chia sẻ, theo dõi khách đủ điều kiện và nhận hoa hồng minh bạch.</p>
          <Link href="/tai-khoan?returnTo=%2Fru-ban" className="mt-5 inline-flex rounded-full bg-[#9f1d20] px-5 py-3 text-sm font-semibold text-white">Đăng nhập hoặc tạo tài khoản</Link>
        </section>
      </main>
    );
  }

  if (referral.activationRequired) {
    return (
      <main className="mx-auto max-w-xl px-4 py-8 text-[#191414] sm:px-6">
        <section className="rounded-3xl bg-white p-6 text-center shadow-xl ring-1 ring-[#eadbd1]">
          <ShieldCheck className="mx-auto text-[#9f1d20]" size={34} />
          <h1 className="mt-3 text-xl font-semibold">Xác minh một lần để kích hoạt Affiliate</h1>
          <p className="mt-2 text-sm leading-6 text-[#665b55]">Xác minh số điện thoại giúp mã giới thiệu gắn đúng người nhận hoa hồng. Sau đó bạn có thể chia sẻ link hoặc QR không giới hạn lượt.</p>
          <Link href="/tai-khoan?returnTo=%2Fru-ban" className="mt-5 inline-flex rounded-full bg-[#9f1d20] px-5 py-3 text-sm font-semibold text-white">Xác minh số điện thoại</Link>
        </section>
      </main>
    );
  }

  if (!referral.code) {
    return (
      <main className="mx-auto max-w-xl px-4 py-8 text-[#191414] sm:px-6">
        <section className="rounded-3xl bg-white p-6 text-center shadow-xl ring-1 ring-[#eadbd1]">
          <BadgePercent className="mx-auto text-[#9f1d20]" size={34} />
          <h1 className="mt-3 text-xl font-semibold">Mã Affiliate đang được khởi tạo</h1>
          <p className="mt-2 text-sm leading-6 text-[#665b55]">Tài khoản đã sẵn sàng nhưng chưa có mã chia sẻ. Vui lòng thử tải lại sau hoặc liên hệ bộ phận hỗ trợ.</p>
        </section>
      </main>
    );
  }

  async function copyCode() {
    await navigator.clipboard.writeText(referral.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function share() {
    const referralLink = `${window.location.origin}${referralPath}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Tâm An Care", text: shareText, url: referralLink });
        return;
      } catch {
        // người dùng huỷ chia sẻ, rơi xuống copy bên dưới
      }
    }
    await navigator.clipboard.writeText(`${shareText} ${referralLink}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function toggleQr() {
    if (!showQr && !qrDataUrl) {
      setQrLoading(true);
      const referralLink = `${window.location.origin}${referralPath}`;
      const dataUrl = await QRCode.toDataURL(referralLink, { margin: 1, width: 220, color: { dark: "#191414", light: "#ffffff" } });
      setQrDataUrl(dataUrl);
      setQrLoading(false);
    }
    setShowQr((value) => !value);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-6 pt-3 text-[#191414] sm:px-6">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5c3a1e] text-[#f5d982]"><BadgePercent size={20} /></span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Affiliate Tâm An</h1>
          <p className="mt-0.5 text-xs leading-5 text-[#8a7a72]">Theo dõi mã giới thiệu, đơn phát sinh và thu nhập Affiliate một tầng.</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-[#eadbd1] bg-gradient-to-br from-[#231514] to-[#3d1f12] text-white shadow-lg">
        <div className="p-5 sm:p-6">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#e3b23c]">
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
              <div className="h-full rounded-full bg-[#e3b23c]" style={{ width: `${tierProgress}%` }} />
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
                      className="w-full rounded-t-md bg-gradient-to-t from-[#e3b23c] to-[#f4dba0]"
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

      <section className="mt-4 rounded-xl border border-[#eadbd1] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9f1d20]">Mã giới thiệu của bạn</p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fff2ef] px-2 py-0.5 text-[10px] font-semibold text-[#9f1d20]">
            {tier.icon} {tier.name}
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex flex-1 items-center justify-between gap-2 rounded-xl bg-[#fff7f3] px-3 py-2.5">
            <span className="truncate text-base font-bold tracking-wide text-[#191414]">{referral.code}</span>
            <button
              type="button"
              onClick={copyCode}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition",
                copied ? "bg-[#1d8f55] text-white" : "bg-[#9f1d20] text-white"
              )}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
          <button
            type="button"
            onClick={share}
            aria-label="Chia sẻ link giới thiệu"
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#c22630] to-[#8f151a] text-white shadow-sm"
          >
            <Share2 size={17} />
          </button>
          <button
            type="button"
            onClick={toggleQr}
            aria-label="Hiện mã QR giới thiệu"
            className={cn(
              "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border transition",
              showQr ? "border-[#9f1d20] bg-[#fff2ef] text-[#9f1d20]" : "border-[#eadbd1] text-[#9f1d20]"
            )}
          >
            <QrCodeIcon size={17} />
          </button>
        </div>

        {showQr ? (
          <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#eadbd1] bg-[#fdf8f5] p-3">
            {qrLoading ? (
              <Loader2 size={24} className="animate-spin text-[#9f1d20]" />
            ) : qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Mã QR giới thiệu" className="h-32 w-32" />
            ) : null}
            <span className="max-w-full truncate rounded-full bg-white px-2.5 py-1 font-mono text-[10px] text-[#4d403a]">{referralPath}</span>
          </div>
        ) : null}

        <p className="mt-2.5 text-[11px] leading-4 text-[#8a7a72]">
          Chia sẻ link hoặc mã QR — ai đặt lịch qua đây đều được tự động ghi nhận Affiliate 1 tầng cho bạn.
        </p>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-2.5 rounded-xl border border-[#eadbd1] bg-white p-3.5">
          <Gift className="mt-0.5 shrink-0 text-[#9f1d20]" size={18} />
          <div>
            <p className="text-sm font-semibold">Bạn nhận</p>
            <p className="mt-0.5 text-xs leading-5 text-[#665b55]">{referral.rewardForYou}</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl border border-[#eadbd1] bg-white p-3.5">
          <Gift className="mt-0.5 shrink-0 text-[#9f1d20]" size={18} />
          <div>
            <p className="text-sm font-semibold">Bạn bè nhận</p>
            <p className="mt-0.5 text-xs leading-5 text-[#665b55]">{referral.rewardForFriend}</p>
          </div>
        </div>
      </section>

      <section className="mt-5">
        <div className="mb-2.5 flex items-end justify-between gap-4">
          <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
            <UserCheck size={16} className="text-[#9f1d20]" /> Bạn bè đã mời
          </h2>
          <p className="text-sm font-semibold text-[#9f1d20]">Đã nhận {formatMoney(referral.totalEarned)}</p>
        </div>
        <div className="overflow-hidden rounded-xl border border-[#eadbd1] bg-white">
          {referral.invited.map((friend) => (
            <div key={friend.name} className="flex items-center justify-between gap-3 border-b border-[#f1e5dd] px-4 py-2.5 last:border-b-0">
              <div className="min-w-0">
                <p className="text-sm font-medium">{friend.name}</p>
                <p className="text-[11px] text-[#8a7a72]">{friend.joinedAt}</p>
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
