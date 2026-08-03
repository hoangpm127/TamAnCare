"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BriefcaseBusiness, Building2, Check, Copy, Download, Loader2, QrCode, RefreshCw, Search, Send, ShieldCheck, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";

type QrItem = {
  id: string;
  targetType: "BRANCH" | "THERAPIST" | "BUSINESS";
  title: string;
  subtitle: string;
  branchLabel: string;
  version: number;
  dataUrl: string | null;
  link: string | null;
  status: string;
};

const TABS = [
  { value: "BRANCH" as const, label: "Cơ sở", icon: Building2 },
  { value: "THERAPIST" as const, label: "KTV", icon: UserRound },
  { value: "BUSINESS" as const, label: "Business", icon: BriefcaseBusiness },
];

export function AdminQrManagement({ items, role }: { items: QrItem[]; role: "OWNER" | "BRANCH_MANAGER" }) {
  const router = useRouter();
  const [tab, setTab] = useState<QrItem["targetType"]>("BRANCH");
  const [search, setSearch] = useState("");
  const [confirmItem, setConfirmItem] = useState<QrItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const filtered = useMemo(() => items.filter((item) => item.targetType === tab && `${item.title} ${item.subtitle} ${item.branchLabel}`.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi"))), [items, search, tab]);

  async function copy(item: QrItem) {
    if (!item.link) return;
    await navigator.clipboard.writeText(item.link);
    setMessage(`Đã sao chép link QR ${item.title}.`);
  }

  async function share(item: QrItem) {
    if (!item.link) return;
    if (!navigator.share) {
      await copy(item);
      return;
    }
    try {
      await navigator.share({ title: `QR Tâm An Center · ${item.title}`, text: `Mã QR vận hành ${item.title}`, url: item.link });
      setMessage(`Đã mở chia sẻ QR ${item.title}.`);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      await copy(item);
    }
  }

  async function reissue() {
    if (!confirmItem) return;
    setBusyId(confirmItem.id);
    setMessage("");
    try {
      const response = await fetch("/api/admin-qr", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType: confirmItem.targetType, targetId: confirmItem.id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Không thể cấp lại QR.");
      setMessage(payload.message);
      setConfirmItem(null);
      router.refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Không thể cấp lại QR.");
    } finally {
      setBusyId(null);
    }
  }

  return <main className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
    <header className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#173d36] via-[#17634a] to-[#22845a] p-4 text-center text-white shadow-xl">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-[#d9f6e5] ring-1 ring-white/15"><QrCode size={21} /></span>
      <h1 className="mt-2 text-xl font-semibold">Trung tâm quản lý QR</h1>
      <p className="mx-auto mt-1 max-w-2xl text-[10px] leading-4 text-white/70">Quản lý QR check-in/check-out tại cơ sở, QR riêng của KTV và QR triển khai Business. QR cấp lại sẽ làm mã cũ hết hiệu lực ngay.</p>
      <div className="mx-auto mt-3 flex max-w-md items-center justify-center gap-2 text-[9px] font-semibold"><span className="rounded-full bg-white/10 px-2.5 py-1"><ShieldCheck size={11} className="mr-1 inline" />{role === "OWNER" ? "Toàn hệ thống" : "Cơ sở phụ trách"}</span><span className="rounded-full bg-white/10 px-2.5 py-1">{items.length} mã đang quản lý</span></div>
    </header>

    <section className="mt-3 rounded-2xl border border-[#d8b46a]/55 bg-white p-2.5 shadow-sm">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#f6f0ec] p-1">{TABS.map((item) => { const Icon = item.icon; const active = tab === item.value; const count = items.filter((qr) => qr.targetType === item.value).length; return <button key={item.value} type="button" onClick={() => setTab(item.value)} className={cn("flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-semibold", active ? "bg-[#d13f1f] text-white shadow-sm" : "text-[#665b55]")}><Icon size={13} />{item.label}<span className={cn("rounded-full px-1.5 text-[8px]", active ? "bg-white/15" : "bg-white")}>{count}</span></button>; })}</div>
      <label className="mt-2 flex items-center gap-2 rounded-xl border border-[#eadbd1] px-3 py-2"><Search size={14} className="text-[#8a7a72]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm cơ sở, KTV hoặc doanh nghiệp..." className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></label>
    </section>

    {message ? <p className={cn("mt-3 rounded-xl p-3 text-center text-xs", message.startsWith("Đã") ? "bg-[#edf9f2] text-[#12683f]" : "bg-red-50 text-red-700")}>{message}</p> : null}
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((item) => <article key={`${item.targetType}-${item.id}`} className="overflow-hidden rounded-2xl border border-[#d8b46a]/45 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-[#f0e6df] bg-[#fffaf6] p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-0.5 truncate text-[9px] text-[#8a7a72]">{item.subtitle}</p></div><span className="shrink-0 rounded-full bg-[#edf9f2] px-2 py-1 text-[8px] font-bold text-[#16784a]">Phiên {item.version}</span></div>
      <div className="p-3 text-center">{item.dataUrl ? <><div className="mx-auto w-fit rounded-2xl border border-[#d5eadc] bg-white p-2 shadow-sm"><Image unoptimized width={160} height={160} src={item.dataUrl} alt={`QR ${item.title}`} className="h-40 w-40" /></div><p className="mt-2 text-[9px] font-semibold text-[#16784a]">{item.status} · {item.branchLabel}</p></> : <div className="rounded-2xl border border-dashed border-[#d9c8bc] p-8 text-xs text-[#8a7a72]">Chưa có QR vì chưa phân công KTV Business trưởng.</div>}
        {item.dataUrl && item.link ? <div className="mt-3 grid grid-cols-3 gap-1.5"><a href={item.dataUrl} download={`taman-qr-${item.targetType.toLocaleLowerCase()}-${item.id}.png`} className="flex items-center justify-center gap-1 rounded-xl bg-[#edf9f2] px-2 py-2.5 text-[9px] font-semibold text-[#16784a]"><Download size={12} /> Tải</a><button type="button" onClick={() => void copy(item)} className="flex items-center justify-center gap-1 rounded-xl bg-[#fff7ec] px-2 py-2.5 text-[9px] font-semibold text-[#805914]"><Copy size={12} /> Link</button><button type="button" onClick={() => void share(item)} className="flex items-center justify-center gap-1 rounded-xl bg-[#eef5ff] px-2 py-2.5 text-[9px] font-semibold text-[#2452b8]"><Send size={12} /> Gửi</button></div> : null}
        {item.dataUrl ? <button type="button" onClick={() => setConfirmItem(item)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#eadbd1] py-2.5 text-[9px] font-semibold text-[#d13f1f]"><RefreshCw size={12} /> Cấp lại QR & vô hiệu mã cũ</button> : null}
      </div>
    </article>)}{filtered.length === 0 ? <p className="col-span-full rounded-2xl border border-dashed border-[#d9c8bc] bg-white p-8 text-center text-xs text-[#8a7a72]">Không có QR phù hợp bộ lọc.</p> : null}</div>

    {confirmItem ? <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"><button type="button" className="absolute inset-0" onClick={() => setConfirmItem(null)} aria-label="Đóng" /><section className="relative w-full max-w-md rounded-t-[1.75rem] bg-white p-5 shadow-2xl sm:rounded-[1.75rem]"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#d13f1f]">Xác nhận bảo mật</p><h2 className="mt-1 text-lg font-semibold">Cấp lại QR {confirmItem.title}?</h2></div><button type="button" onClick={() => setConfirmItem(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f6efeb]" aria-label="Đóng cửa sổ"><X size={17} /></button></div><p className="mt-3 text-xs leading-5 text-[#665b55]">Mã QR phiên {confirmItem.version} sẽ hết hiệu lực ngay. Các bản in hoặc ảnh đã gửi trước đó không thể dùng check-in/check-out nữa.</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConfirmItem(null)} className="rounded-xl border border-[#eadbd1] py-3 text-xs font-semibold">Giữ mã hiện tại</button><button type="button" disabled={busyId === confirmItem.id} onClick={() => void reissue()} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#d13f1f] py-3 text-xs font-semibold text-white disabled:opacity-50">{busyId === confirmItem.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Cấp mã mới</button></div></section></div> : null}
  </main>;
}
