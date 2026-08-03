"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Star } from "lucide-react";

export function BusinessReviewForm({ eventCode, initialRating, initialComment }: { eventCode: string; initialRating?: number | null; initialComment?: string | null }) {
  const [rating, setRating] = useState(initialRating ?? 5);
  const [comment, setComment] = useState(initialComment ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(Boolean(initialRating));
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true); setError(""); setSaved(false);
    try {
      const response = await fetch(`/api/business-events/${encodeURIComponent(eventCode)}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, comment }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể gửi đánh giá.");
      setSaved(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể gửi đánh giá."); }
    finally { setBusy(false); }
  }

  return <section className="rounded-[2rem] border border-[#d8b46a] bg-gradient-to-br from-[#fffaf0] to-white p-5 shadow-lg"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9f1d20]">Chất lượng phục vụ</p><h2 className="mt-1 text-xl font-semibold">Đánh giá đoàn Business</h2><div className="mt-4 flex justify-center gap-2">{[1,2,3,4,5].map((value) => <button type="button" key={value} onClick={() => { setRating(value); setSaved(false); }} aria-label={`${value} sao`} className="p-1"><Star size={30} className={value <= rating ? "fill-[#e3b23c] text-[#e3b23c]" : "text-[#d8cec8]"} /></button>)}</div><textarea value={comment} onChange={(event) => { setComment(event.target.value); setSaved(false); }} rows={3} maxLength={1000} placeholder="Điều bạn hài lòng hoặc cần Tâm An cải thiện..." className="mt-4 w-full rounded-2xl border border-[#eadbd1] bg-white px-4 py-3 text-sm outline-none focus:border-[#9f1d20]"/><button type="button" onClick={() => void submit()} disabled={busy} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#9f1d20] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : null}{saved ? "Đã ghi nhận đánh giá" : "Gửi đánh giá"}</button>{error ? <p className="mt-2 text-center text-xs text-red-700">{error}</p> : null}</section>;
}
