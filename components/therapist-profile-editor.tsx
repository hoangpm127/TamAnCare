"use client";

import { ChangeEvent, useState } from "react";
import { Camera, CheckCircle2, Loader2, Send, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { TherapistAvatar } from "@/components/therapist-avatar";
import { cn } from "@/lib/utils";

type Status = "DRAFT" | "PENDING" | "APPROVED" | "CHANGES_REQUESTED";
type Initial = { fullName: string; phone: string; avatarUrl: string | null; publicBio: string | null; publicStrengths: string[]; proposedAvatarUrl: string | null; proposedBio: string | null; proposedStrengths: string[]; approvalStatus: Status; reviewNote: string | null };
const STATUS: Record<Status, { label: string; style: string }> = {
  DRAFT: { label: "Chưa gửi duyệt", style: "bg-[#f4ede8] text-[#6e5f57]" },
  PENDING: { label: "Admin đang duyệt", style: "bg-[#fff0c8] text-[#76551d]" },
  APPROVED: { label: "Đã công khai", style: "bg-[#f1e5dd] text-[#76551d]" },
  CHANGES_REQUESTED: { label: "Cần bổ sung", style: "bg-[#ffe0de] text-[#c64b32]" },
};

export function TherapistProfileEditor({ initial, branchLabel }: { initial: Initial; branchLabel: string }) {
  const [avatar, setAvatar] = useState(initial.proposedAvatarUrl ?? initial.avatarUrl ?? "");
  const [bio, setBio] = useState(initial.proposedBio ?? initial.publicBio ?? "");
  const [strengthText, setStrengthText] = useState((initial.proposedStrengths.length ? initial.proposedStrengths : initial.publicStrengths).join("\n"));
  const [status, setStatus] = useState<Status>(initial.approvalStatus);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 900_000) { setMessage("Ảnh cần là PNG, JPG hoặc WebP và nhỏ hơn 900 KB."); return; }
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  async function submit() {
    const strengths = strengthText.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean).slice(0, 6);
    if (bio.trim().length < 30 || strengths.length === 0) { setMessage("Hãy viết giới thiệu ít nhất 30 ký tự và thêm ít nhất một điểm mạnh."); return; }
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/therapist-profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bio, strengths, avatarUrl: avatar || null }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Chưa thể gửi hồ sơ.");
      setStatus("PENDING"); setMessage("Đã gửi hồ sơ. Admin sẽ duyệt trước khi thông tin xuất hiện cho khách.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Chưa thể gửi hồ sơ."); }
    finally { setSaving(false); }
  }

  const meta = STATUS[status];
  return <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6">
    <header className="rounded-3xl bg-gradient-to-br from-[#291714] via-[#63301f] to-[#c64b32] p-5 text-center text-white shadow-xl"><p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#e7c878]"><UserRound size={15} /> Hồ sơ KTV của tôi</p><h1 className="mt-2 text-xl font-semibold">Xây dựng dấu ấn phục vụ riêng</h1><p className="mt-1 text-[10px] text-white/70">Thông tin chỉ hiển thị cho khách sau khi Admin duyệt.</p></header>
    <section className="mt-3 rounded-2xl border border-[#d2ad5d]/55 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3"><div className="relative"><TherapistAvatar id={initial.fullName} src={avatar || null} size={70} className="rounded-2xl" /><label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#76551d] text-white shadow"><Camera size={14} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectAvatar} className="sr-only" /></label></div><div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold">{initial.fullName}</h2><p className="mt-0.5 text-[10px] text-[#826f66]">{initial.phone} · {branchLabel}</p><span className={cn("mt-2 inline-flex rounded-full px-2.5 py-1 text-[9px] font-bold", meta.style)}>{meta.label}</span></div></div>
      {initial.reviewNote && status === "CHANGES_REQUESTED" ? <div className="mt-3 rounded-xl bg-[#f8ebe5] p-3 text-[10px] leading-5 text-[#8f2929]"><strong>Admin nhắn:</strong> {initial.reviewNote}</div> : null}
      <label className="mt-4 block text-[10px] font-semibold">Giới thiệu phục vụ <span className="font-normal text-[#826f66]">({bio.length}/600)</span><textarea value={bio} onChange={(event) => setBio(event.target.value.slice(0, 600))} rows={5} placeholder="Ví dụ: Tôi chú trọng lắng nghe thể trạng, điều chỉnh lực tay và nhịp trị liệu để khách thư giãn an toàn..." className="mt-1.5 w-full rounded-2xl border border-[#dfd1c8] bg-[#fffdfb] p-3 text-xs leading-5 outline-none focus:border-[#76551d]" /></label>
      <label className="mt-3 block text-[10px] font-semibold">Điểm mạnh chuyên môn <span className="font-normal text-[#826f66]">(mỗi dòng một điểm, tối đa 6)</span><textarea value={strengthText} onChange={(event) => setStrengthText(event.target.value)} rows={4} placeholder={"Chăm sóc cổ vai gáy\nFoot massage\nĐiều chỉnh lực theo thể trạng"} className="mt-1.5 w-full rounded-2xl border border-[#dfd1c8] bg-[#fffdfb] p-3 text-xs leading-5 outline-none focus:border-[#76551d]" /></label>
      <div className="mt-3 rounded-2xl bg-[#fbf2e7] p-3 text-[10px] leading-5 text-[#76551d]"><ShieldCheck size={14} className="mr-1 inline" />Admin kiểm tra ảnh, nội dung và điểm mạnh. Khi duyệt, khách sẽ thấy hồ sơ này tại Trang chủ và màn hình chọn KTV.</div>
      {message ? <p className={cn("mt-3 rounded-xl p-3 text-[10px]", message.startsWith("Đã gửi") ? "bg-[#fbf2e7] text-[#76551d]" : "bg-[#f8ebe5] text-[#c64b32]")}>{message}</p> : null}
      <button type="button" onClick={() => void submit()} disabled={saving} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#c64b32] py-3 text-xs font-semibold text-white disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : status === "APPROVED" ? <Sparkles size={15} /> : status === "PENDING" ? <CheckCircle2 size={15} /> : <Send size={15} />}{saving ? "Đang gửi..." : status === "APPROVED" ? "Gửi nội dung cập nhật để duyệt" : status === "PENDING" ? "Gửi lại bản cập nhật" : "Gửi Admin duyệt hồ sơ"}</button>
    </section>
  </div>;
}
