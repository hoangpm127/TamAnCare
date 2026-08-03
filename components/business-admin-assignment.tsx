"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, QrCode, UserRoundCog } from "lucide-react";
import { CompactSelect } from "@/components/compact-select";

export function BusinessAdminAssignment({ eventCode, initialTherapistId, therapists }: { eventCode: string; initialTherapistId?: string | null; therapists: Array<{ id: string; label: string }> }) {
  const [therapistId, setTherapistId] = useState(initialTherapistId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save() {
    if (!therapistId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/business-events/${encodeURIComponent(eventCode)}/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ therapistId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể phân công KTV trưởng.");
      setMessage(`Đã phân công ${data.event.leadTherapist}; QR mới đã được kích hoạt.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể phân công KTV trưởng."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-[2rem] border border-[#d2ad5d] bg-gradient-to-br from-[#fffaf0] to-white p-5 shadow-lg"><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#c64b32] text-white"><UserRoundCog size={20}/></span><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#c64b32]">Điều phối đoàn</p><h2 className="mt-1 text-lg font-semibold">KTV Business trưởng</h2><p className="mt-1 text-xs leading-5 text-[#76665d]">KTV trưởng trình QR cho khách, điều phối đội và chịu trách nhiệm chốt phiên.</p></div></div><div className="mt-4"><CompactSelect value={therapistId} onValueChange={(value) => { setTherapistId(value); setMessage(""); }} dialogTitle="Chọn KTV Business trưởng" triggerClassName="rounded-2xl" options={[{ value: "", label: "Chọn KTV tại cơ sở" }, ...therapists.map((item) => ({ value: item.id, label: item.label }))]}/></div><button onClick={() => void save()} disabled={!therapistId || busy} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#c64b32] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin"/> : <QrCode size={16}/>} Phân công & cấp QR riêng</button>{message ? <p className="mt-3 flex items-start gap-2 rounded-2xl bg-[#fbf2e7] p-3 text-xs leading-5 text-[#9a5a16]"><CheckCircle2 size={15} className="mt-0.5 shrink-0"/>{message}</p> : null}{error ? <p className="mt-3 rounded-2xl bg-red-50 p-3 text-xs text-red-700">{error}</p> : null}</section>;
}
