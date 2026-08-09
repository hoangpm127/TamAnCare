"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { normalizeCustomerPin } from "@/lib/customer-pin";

export function AdminCustomerPinReset({ customerId, configured }: { customerId: string; configured: boolean }) {
  const [pin, setPin] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/customers/${customerId}/pin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Chưa thể cấp lại Mã PIN.");
      setPin("");
      setMessage("Đã cấp Mã PIN mới và đăng xuất các thiết bị cũ.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chưa thể cấp lại Mã PIN.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-[#d2ad5d]/60 bg-[#fff9ed] p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#6f211f]"><KeyRound size={16} /> {configured ? "Cấp lại Mã PIN Tâm An" : "Tạo Mã PIN Tâm An"}</p>
      <p className="mt-1 text-xs leading-5 text-[#68574f]">Chỉ thực hiện khi khách có mặt và đã được đối chiếu trực tiếp. Không đọc mã qua điện thoại hoặc tin nhắn.</p>
      <div className="mt-3 flex gap-2">
        <div className="flex min-w-0 flex-1 items-center rounded-lg border border-[#e7d6ca] bg-white px-3">
          <input aria-label="Mã PIN Tâm An mới" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} type={show ? "text" : "password"} value={pin} onChange={(event) => setPin(normalizeCustomerPin(event.target.value))} className="min-w-0 flex-1 py-2.5 text-center font-mono text-lg tracking-[0.35em] outline-none" />
          <button type="button" onClick={() => setShow((value) => !value)} aria-label={show ? "Ẩn Mã PIN" : "Hiện Mã PIN"} className="p-2 text-[#826f66]">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        <button type="button" disabled={busy || pin.length !== 4} onClick={() => void save()} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#6f211f] px-4 text-xs font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={14} /> : <KeyRound size={14} />} Lưu mã</button>
      </div>
      {message ? <p className="mt-2 text-xs font-medium text-[#6f211f]">{message}</p> : null}
    </div>
  );
}
