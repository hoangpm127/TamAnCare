"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { displayBookingCode } from "@/lib/utils";

export function ReviewForm({ bookingCode }: { bookingCode: string }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [wantsRebook, setWantsRebook] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingCode, rating, comment, wantsRebook }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Không thể lưu đánh giá.");
      return;
    }
    setDone(true);
  }

  return (
    <main className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-[#fffaf6] px-4 text-[#191414]">
      <section className="w-full max-w-xl rounded-xl border border-[#eadbd1] bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9f1d20]">Đánh giá trải nghiệm</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">Hóa đơn {displayBookingCode(bookingCode)}</h1>
        {done ? (
          <div className="mt-5 rounded-xl bg-[#f2fff7] p-4 text-sm text-[#1d6c40]">
            Cảm ơn bạn đã đánh giá. Tâm An sẽ ưu tiên gợi ý KTV này cho lần đặt sau nếu còn slot.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold">Điểm đánh giá</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button key={value} type="button" onClick={() => setRating(value)} className="text-[#9f1d20]">
                    <Star fill={value <= rating ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="text-sm font-semibold">Ghi chú</span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                className="mt-2 min-h-28 w-full rounded-xl border border-[#eadbd1] px-3 py-3"
              />
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={wantsRebook} onChange={(event) => setWantsRebook(event.target.checked)} />
              Tôi muốn đặt lại KTV này lần sau
            </label>
            <button type="button" onClick={submit} className="w-full rounded-full bg-[#9f1d20] px-5 py-3 font-semibold text-white">
              Gửi đánh giá
            </button>
            {error ? <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p> : null}
          </div>
        )}
      </section>
    </main>
  );
}
