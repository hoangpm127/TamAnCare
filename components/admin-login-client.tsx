"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { adminLandingPath } from "@/lib/admin-auth";
import { BrandWordmark } from "@/components/brand-wordmark";

export function AdminLoginClient() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    let keepBusyForNavigation = false;
    try {
      const response = await fetch("/api/admin-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, mfaCode: mfaRequired ? mfaCode : undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể đăng nhập.");
      if (data.mfaRequired) {
        setMfaRequired(true);
        setMfaCode("");
        return;
      }
      const destination = data.account?.mustChangePassword
        ? "/doi-mat-khau-quan-tri"
        : data.account?.mustEnrollMfa
          ? "/bao-mat-quan-tri"
        : adminLandingPath(data.account?.role ?? "RECEPTIONIST");
      keepBusyForNavigation = true;
      router.replace(destination);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đăng nhập.");
    } finally {
      if (!keepBusyForNavigation) setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#241514] px-3 py-3 text-[#191414] sm:px-6 sm:py-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(227,178,60,0.2),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(159,29,32,0.28),transparent_42%)]" />
      <div className="relative mx-auto max-w-4xl">
        <Link href="/toi" className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white/75 hover:text-white">
          <ArrowLeft size={16} /> Về giao diện khách hàng
        </Link>
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#fffaf6] shadow-2xl sm:rounded-3xl">
          <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
            <div className="bg-gradient-to-br from-[#8f151a] via-[#5c1014] to-[#2a1513] p-5 text-white lg:p-7">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon-64.png" alt="" className="h-10 w-10 rounded-full ring-1 ring-[#e3b23c]" />
                <div><BrandWordmark className="h-[18px] w-[132px] text-[#f5dc8f]" /><p className="mt-0.5 text-[10px] text-white/65">Vận hành & đầu tư</p></div>
              </div>
              <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f5d982]">Khu vực được bảo vệ</p>
              <h1 className="mt-1 text-2xl font-semibold leading-tight">Đăng nhập theo tài khoản được cấp</h1>
              <p className="mt-3 text-sm leading-6 text-white/72">Dữ liệu được giới hạn ở máy chủ theo đúng vai trò và cơ sở phụ trách.</p>
              <div className="mt-5 space-y-2.5 text-xs text-white/75">
                {["Không lưu mật khẩu trên trình duyệt", "Tự khóa khi đăng nhập sai nhiều lần", "Phiên đăng nhập được mã hóa và giới hạn thời gian"].map((item) => (
                  <p key={item} className="flex items-center gap-2"><Check size={14} className="text-[#f5d982]" /> {item}</p>
                ))}
              </div>
            </div>

            <div className="p-5 lg:p-7">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d13f1f]">Xác thực nội bộ</p><h2 className="mt-1 text-xl font-semibold">Đăng nhập quản trị</h2><p className="mt-1 text-xs leading-5 text-[#8a7a72]">Dành cho Xgroup, Admin, Trưởng phòng Quận, Quản lý, Lễ tân, KTV và Nhà đầu tư được cấp quyền.</p></div>
                <ShieldCheck className="shrink-0 text-[#d13f1f]" size={30} />
              </div>

              <form onSubmit={signIn} className="mt-6 space-y-3">
                {mfaRequired ? (
                  <div className="rounded-2xl bg-[#fff7ec] p-4 ring-1 ring-[#eadbd1]">
                    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#d13f1f] ring-1 ring-[#eadbd1]"><KeyRound size={19} /></span>
                    <p className="mt-2 text-center text-sm font-semibold">Xác thực bước hai</p>
                    <p className="mt-1 text-center text-[11px] leading-5 text-[#786a63]">Nhập mã 6 số từ ứng dụng Authenticator hoặc một mã khôi phục chưa dùng.</p>
                    <label className="mt-3 block">
                      <span className="text-[11px] font-semibold">Mã xác thực</span>
                      <input required autoFocus value={mfaCode} onChange={(event) => setMfaCode(event.target.value.toUpperCase())} autoComplete="one-time-code" inputMode="text" maxLength={40} className="mt-1.5 w-full rounded-xl border border-[#eadbd1] bg-white px-3 py-3 text-center font-mono text-lg tracking-[0.2em] outline-none focus:border-[#d13f1f]" placeholder="000000" />
                    </label>
                    <button type="button" onClick={() => { setMfaRequired(false); setMfaCode(""); setPassword(""); setError(""); }} className="mt-2 w-full text-center text-[11px] font-semibold text-[#d13f1f]">Dùng tài khoản khác</button>
                  </div>
                ) : (
                  <>
                <label className="block">
                  <span className="text-[11px] font-semibold">Tài khoản</span>
                  <span className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#eadbd1] bg-white px-3 focus-within:border-[#d13f1f]">
                    <UserRound size={16} className="shrink-0 text-[#8a7a72]" />
                    <input required value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" inputMode="text" maxLength={100} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" placeholder="Nhập tài khoản được cấp" />
                  </span>
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold">Mật khẩu</span>
                  <span className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#eadbd1] bg-white px-3 focus-within:border-[#d13f1f]">
                    <LockKeyhole size={16} className="shrink-0 text-[#8a7a72]" />
                    <input required type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" maxLength={200} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" placeholder="Nhập mật khẩu" />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="text-[#8a7a72]" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  </span>
                </label>
                  </>
                )}
                {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">{error}</p> : null}
                <button type="submit" disabled={submitting} aria-busy={submitting} className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#c22630] to-[#8f151a] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#5c1014]/20 disabled:opacity-60">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  {submitting ? "Đang xác thực…" : mfaRequired ? "Xác nhận mã bảo mật" : "Đăng nhập an toàn"}
                </button>
              </form>
              <p className="mt-3 text-center text-[10px] leading-4 text-[#8a7a72]">Tài khoản bị tạm khóa 15–30 phút khi đăng nhập sai liên tiếp.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
