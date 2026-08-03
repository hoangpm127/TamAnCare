"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Bell, CheckCircle2, ChevronLeft, HeartPulse, Save, Settings2, UserRound } from "lucide-react";
import {
  saveCustomerProfile,
  useCustomerProfile,
  type CustomerProfile,
} from "@/lib/customer-profile-store";
import { cn } from "@/lib/utils";

export function ProfileSettingsClient() {
  const profile = useCustomerProfile();
  const [draft, setDraft] = useState<Partial<CustomerProfile>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const form = { ...profile, ...draft };

  function update<K extends keyof CustomerProfile>(key: K, value: CustomerProfile[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await saveCustomerProfile(form);
      setDraft({});
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể lưu hồ sơ.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-8 pt-3 text-[#191414] sm:px-6">
      <div className="mb-3 flex items-center gap-3">
        <Link href="/toi" aria-label="Quay lại trang Tôi" className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#d13f1f] shadow-sm ring-1 ring-[#eadbd1]">
          <ChevronLeft size={19} />
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><Settings2 size={20} className="text-[#d13f1f]" /> Cài đặt tài khoản</h1>
          <p className="mt-0.5 text-xs text-[#8a7a72]">Thông tin dùng để đặt lịch và cá nhân hóa dịch vụ.</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <section className="rounded-2xl border border-[#eadbd1] bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><UserRound size={17} className="text-[#d13f1f]" /> Thông tin cá nhân</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-[#665b55]">Họ và tên
              <input required value={form.fullName} onChange={(event) => update("fullName", event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#eadbd1] px-3 py-2.5 text-sm text-[#191414]" />
            </label>
            <label className="text-xs font-medium text-[#665b55]">Số điện thoại
              <input readOnly value={form.phone} className="mt-1.5 w-full rounded-xl border border-[#eadbd1] bg-[#f7f3f0] px-3 py-2.5 text-sm text-[#665b55]" />
              <span className="mt-1 block text-[10px] font-normal text-[#8a7a72]">Đổi số đăng nhập cần xác minh tại quầy để bảo vệ tài khoản.</span>
            </label>
            <label className="text-xs font-medium text-[#665b55]">Email
              <input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#eadbd1] px-3 py-2.5 text-sm text-[#191414]" />
            </label>
            <label className="text-xs font-medium text-[#665b55]">Ngày sinh
              <input type="date" value={form.birthDate} onChange={(event) => update("birthDate", event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#eadbd1] px-3 py-2.5 text-sm text-[#191414]" />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-[#eadbd1] bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><HeartPulse size={17} className="text-[#d13f1f]" /> Sở thích & lưu ý dịch vụ</h2>
          <div className="mt-3">
            <p className="text-xs font-medium text-[#665b55]">Lực massage ưa thích</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["NHẸ", "VỪA", "MẠNH"] as const).map((pressure) => (
                <button key={pressure} type="button" onClick={() => update("preferredPressure", pressure)} className={cn("rounded-xl border px-3 py-2.5 text-xs font-semibold", form.preferredPressure === pressure ? "border-[#d13f1f] bg-[#fff2ef] text-[#d13f1f]" : "border-[#eadbd1] text-[#665b55]")}>{pressure.charAt(0) + pressure.slice(1).toLowerCase()}</button>
              ))}
            </div>
          </div>
          <label className="mt-3 block text-xs font-medium text-[#665b55]">Tình trạng sức khỏe hoặc vùng cần lưu ý
            <textarea value={form.healthNotes} onChange={(event) => update("healthNotes", event.target.value)} placeholder="Ví dụ: đau cổ vai gáy, tránh lực mạnh ở lưng dưới..." className="mt-1.5 min-h-24 w-full rounded-xl border border-[#eadbd1] px-3 py-2.5 text-sm text-[#191414]" />
          </label>
        </section>

        <section className="rounded-2xl border border-[#eadbd1] bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Bell size={17} className="text-[#d13f1f]" /> Thông báo</h2>
          <div className="mt-3 space-y-3">
            <SettingSwitch label="Nhắc lịch hẹn" description="Nhận thông báo trước giờ massage." checked={form.bookingReminders} onChange={(value) => update("bookingReminders", value)} />
            <SettingSwitch label="Ưu đãi phù hợp" description="Nhận voucher theo lịch sử sử dụng." checked={form.promotionUpdates} onChange={(value) => update("promotionUpdates", value)} />
          </div>
        </section>

        {saved ? <p className="flex items-center justify-center gap-1.5 rounded-xl bg-[#eafaf1] p-3 text-sm font-semibold text-[#1d6c40]"><CheckCircle2 size={17} /> Đã lưu thông tin tài khoản vào hệ thống.</p> : null}
        {error ? <p className="rounded-xl bg-red-50 p-3 text-center text-xs font-medium text-red-700">{error}</p> : null}
        <button type="submit" disabled={saving || !form.fullName || !form.phone} className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#c22630] to-[#8f151a] px-5 py-3 text-sm font-semibold text-white shadow-md disabled:opacity-50"><Save size={17} /> {saving ? "Đang lưu…" : "Lưu thay đổi"}</button>
      </form>
    </main>
  );
}

function SettingSwitch({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{label}</p><p className="text-xs text-[#8a7a72]">{description}</p></div>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cn("flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition", checked ? "justify-end bg-[#d13f1f]" : "justify-start bg-[#d9ccc5]")}>
        <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
      </button>
    </div>
  );
}
