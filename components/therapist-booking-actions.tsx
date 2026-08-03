"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function TherapistBookingActions({ bookingCode, initialStatus }: { bookingCode: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startService() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingCode)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_SERVICE" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể bắt đầu ca.");
      setStatus("IN_SERVICE");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể bắt đầu ca.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-5">
      {status === "CONFIRMED" || status === "CHECKED_IN" ? <button type="button" onClick={startService} disabled={loading} className="inline-flex rounded-full bg-[#9f1d20] px-5 py-3 font-semibold text-white disabled:opacity-60">{loading ? <Loader2 className="mr-2 animate-spin" size={16} /> : null}Bắt đầu ca</button> : null}
      {status === "IN_SERVICE" ? <p className="rounded-xl bg-[#edf9f2] p-3 text-sm font-semibold text-[#16784a]">Ca đang phục vụ. Khách hoặc quầy sẽ check-out và đối soát thanh toán khi kết thúc.</p> : null}
      {error ? <p className="mt-2 text-sm text-[#9f1d20]">{error}</p> : null}
    </div>
  );
}
