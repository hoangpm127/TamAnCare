"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, Copy, KeyRound, Loader2, Save, Trash2, X } from "lucide-react";

export type TherapistScheduleView = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  isActive: boolean;
};

export type TherapistEditableView = {
  id: string;
  branchId: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  publicBio: string | null;
  publicStrengths: string[];
  gender: string | null;
  skills: string[];
  status: "ACTIVE" | "OFF" | "HIDDEN";
  onlineBooking: boolean;
  internalNote: string | null;
  serviceIds: string[];
  schedules: TherapistScheduleView[];
  shiftLabel: string;
};

type Props = {
  therapist: TherapistEditableView | null;
  branches: Array<{ id: string; label: string }>;
  services: Array<{ id: string; name: string }>;
  fixedBranchId?: string | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

const DAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

function timeValue(minutes: number) {
  const safe = Math.min(minutes, 1439);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function timeMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function defaultSchedules(shiftLabel?: string): TherapistScheduleView[] {
  const match = shiftLabel?.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  const startMinute = match ? Number(match[1]) * 60 + Number(match[2]) : 9 * 60;
  const endMinute = match ? Number(match[3]) * 60 + Number(match[4]) : 21 * 60;
  return DAY_LABELS.map((_, index) => ({ weekday: index + 1, startMinute, endMinute, isActive: true }));
}

export function AdminTherapistEditor({ therapist, branches, services, fixedBranchId, onClose, onSaved }: Props) {
  const initialSchedules = useMemo(() => therapist?.schedules.length ? therapist.schedules : defaultSchedules(therapist?.shiftLabel), [therapist]);
  const [branchId, setBranchId] = useState(therapist?.branchId ?? fixedBranchId ?? branches[0]?.id ?? "");
  const [fullName, setFullName] = useState(therapist?.fullName ?? "");
  const [phone, setPhone] = useState(therapist?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(therapist?.avatarUrl ?? "");
  const [publicBio, setPublicBio] = useState(therapist?.publicBio ?? "");
  const [strengths, setStrengths] = useState((therapist?.publicStrengths ?? []).join(", "));
  const [skills, setSkills] = useState((therapist?.skills ?? []).join(", "));
  const [gender, setGender] = useState(therapist?.gender ?? "Nữ");
  const [status, setStatus] = useState<"ACTIVE" | "OFF" | "HIDDEN">(therapist?.status ?? "ACTIVE");
  const [onlineBooking, setOnlineBooking] = useState(therapist?.onlineBooking ?? true);
  const [internalNote, setInternalNote] = useState(therapist?.internalNote ?? "");
  const [serviceIds, setServiceIds] = useState<string[]>(therapist?.serviceIds.length ? therapist.serviceIds : services.map((service) => service.id));
  const [schedules, setSchedules] = useState<TherapistScheduleView[]>(initialSchedules);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issuedCredentials, setIssuedCredentials] = useState<null | { username: string; temporaryPassword: string; mustChangePassword: boolean }>(null);
  const [copied, setCopied] = useState(false);

  function updateSchedule(weekday: number, patch: Partial<TherapistScheduleView>) {
    setSchedules((current) => {
      const existing = current.find((item) => item.weekday === weekday)
        ?? defaultSchedules()[weekday - 1];
      return [...current.filter((item) => item.weekday !== weekday), { ...existing, ...patch }]
        .sort((a, b) => a.weekday - b.weekday);
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        branchId,
        fullName,
        phone: phone || null,
        avatarUrl: avatarUrl || null,
        publicBio: publicBio || null,
        publicStrengths: strengths.split(",").map((item) => item.trim()).filter(Boolean),
        skills: skills.split(",").map((item) => item.trim()).filter(Boolean),
        serviceIds,
        gender: gender || null,
        status,
        onlineBooking,
        internalNote: internalNote || null,
        schedules: schedules.filter((item) => item.isActive),
      };
      const response = await fetch(therapist ? `/api/admin-therapists/${therapist.id}` : "/api/admin-therapists", {
        method: therapist ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể lưu KTV.");
      await onSaved();
      if (data.credentials?.username && data.credentials?.temporaryPassword) {
        setIssuedCredentials(data.credentials);
        return;
      }
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu KTV.");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!therapist || !window.confirm(`Xóa ${therapist.fullName} khỏi danh sách đặt lịch? Dữ liệu booking cũ vẫn được bảo toàn.`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin-therapists/${therapist.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể ngừng KTV.");
      await onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể ngừng KTV.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCredentials() {
    if (!issuedCredentials) return;
    await navigator.clipboard.writeText(`Tài khoản: ${issuedCredentials.username}\nMật khẩu: ${issuedCredentials.temporaryPassword}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  if (issuedCredentials) {
    return (
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#231514]/70 p-3 backdrop-blur-sm sm:p-6">
        <section className="mx-auto max-w-lg overflow-hidden rounded-3xl bg-[#fdf8f3] shadow-2xl">
          <header className="flex items-start justify-between gap-3 border-b border-[#e7d6ca] bg-white px-4 py-3 sm:px-5">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#c64b32]">Đã tạo KTV & tài khoản</p><h2 className="mt-0.5 text-lg font-semibold">Bàn giao thông tin đăng nhập</h2></div>
            <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fbf2e7]" aria-label="Đóng"><X size={17} /></button>
          </header>
          <div className="p-4 sm:p-5">
            <div className="rounded-2xl border border-[#d2ad5d] bg-gradient-to-br from-[#fffaf0] to-white p-4">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#fbf2e7] text-[#a85f29]"><KeyRound size={20} /></span>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white p-3 ring-1 ring-[#e7d6ca]"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#826f66]">Tài khoản</p><p className="mt-1 font-mono text-base font-semibold">{issuedCredentials.username}</p></div>
                <div className="rounded-xl bg-white p-3 ring-1 ring-[#e7d6ca]"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#826f66]">Mật khẩu tạm thời</p><p className="mt-1 font-mono text-base font-semibold">{issuedCredentials.temporaryPassword}</p></div>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-[#68574f]">KTV đăng nhập bằng số điện thoại và phải đổi mật khẩu tạm thời ở lần đăng nhập đầu. Mật khẩu mới chỉ được lưu dưới dạng hash nên Admin không thể đọc lại.</p>
              <button type="button" onClick={() => void copyCredentials()} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#76551d] px-4 py-2.5 text-xs font-semibold text-white">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Đã sao chép" : "Sao chép tài khoản"}</button>
            </div>
          </div>
          <footer className="flex justify-end border-t border-[#e7d6ca] bg-white px-4 py-3 sm:px-5"><button type="button" onClick={onClose} className="rounded-full bg-[#c64b32] px-5 py-2.5 text-xs font-semibold text-white">Đã bàn giao</button></footer>
        </section>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#231514]/70 p-3 backdrop-blur-sm sm:p-6">
      <form onSubmit={submit} className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-[#fdf8f3] shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#e7d6ca] bg-white px-4 py-3 sm:px-5">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#c64b32]">Nhân sự & lịch tuần</p><h2 className="mt-0.5 text-lg font-semibold">{therapist ? `Chỉnh sửa ${therapist.fullName}` : "Thêm kỹ thuật viên"}</h2></div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fbf2e7]" aria-label="Đóng"><X size={17} /></button>
        </header>

        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <label className="text-xs font-semibold">Họ tên KTV<input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]" /></label>
          <label className="text-xs font-semibold">Cơ sở<select value={branchId} onChange={(event) => setBranchId(event.target.value)} disabled={Boolean(fixedBranchId)} className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal disabled:opacity-60">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.label}</option>)}</select></label>
          <label className="text-xs font-semibold">Số điện thoại / tài khoản đăng nhập<input required value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="off" className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]" /><span className="mt-1 block text-[9px] font-normal leading-4 text-[#826f66]">Khi thêm mới, mật khẩu tạm thời cũng là số điện thoại này.</span></label>
          <label className="text-xs font-semibold">Giới tính<input value={gender} onChange={(event) => setGender(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]" /></label>
          <label className="text-xs font-semibold sm:col-span-2">Ảnh đại diện (URL)<input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} inputMode="url" className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]" placeholder="https://..." /></label>
          <label className="text-xs font-semibold sm:col-span-2">Kỹ năng nội bộ, cách nhau bằng dấu phẩy<input required value={skills} onChange={(event) => setSkills(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]" placeholder="Cổ vai gáy, Body, Chân" /></label>
          <label className="text-xs font-semibold sm:col-span-2">Lợi điểm hiển thị cho khách, cách nhau bằng dấu phẩy<input value={strengths} onChange={(event) => setStrengths(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]" /></label>
          <label className="text-xs font-semibold sm:col-span-2">Giới thiệu công khai<textarea value={publicBio} onChange={(event) => setPublicBio(event.target.value)} rows={2} className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]" /></label>

          <fieldset className="rounded-2xl border border-[#e7d6ca] bg-white p-3 sm:col-span-2">
            <legend className="px-1 text-xs font-semibold">Dịch vụ KTV được nhận</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">{services.map((service) => <label key={service.id} className="flex items-start gap-2 rounded-xl bg-[#fdf8f3] p-2.5 text-[11px]"><input type="checkbox" checked={serviceIds.includes(service.id)} onChange={(event) => setServiceIds((current) => event.target.checked ? [...new Set([...current, service.id])] : current.filter((id) => id !== service.id))} className="mt-0.5" /><span>{service.name}</span></label>)}</div>
          </fieldset>

          <fieldset className="rounded-2xl border border-[#e7d6ca] bg-white p-3 sm:col-span-2">
            <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold"><CalendarDays size={14} className="text-[#c64b32]" /> Lịch làm việc lặp lại hàng tuần</legend>
            <p className="mt-1 text-[10px] leading-4 text-[#826f66]">Khách chỉ thấy giờ đặt nằm trọn trong ca làm. Ngày bỏ chọn được tính là ngày nghỉ định kỳ.</p>
            <div className="mt-2 space-y-2">{DAY_LABELS.map((label, index) => {
              const weekday = index + 1;
              const schedule = schedules.find((item) => item.weekday === weekday) ?? { weekday, startMinute: 540, endMinute: 1260, isActive: false };
              return <div key={weekday} className="grid grid-cols-[88px_1fr_1fr] items-center gap-2 rounded-xl bg-[#fdf8f3] p-2"><label className="flex items-center gap-2 text-[11px] font-semibold"><input type="checkbox" checked={schedule.isActive} onChange={(event) => updateSchedule(weekday, { isActive: event.target.checked })} />{label}</label><input aria-label={`Giờ bắt đầu ${label}`} type="time" step="900" value={timeValue(schedule.startMinute)} onChange={(event) => updateSchedule(weekday, { startMinute: timeMinutes(event.target.value), isActive: true })} disabled={!schedule.isActive} className="min-w-0 rounded-lg border border-[#dfd1c8] bg-white px-2 py-2 text-[11px] disabled:opacity-40" /><input aria-label={`Giờ kết thúc ${label}`} type="time" step="900" value={timeValue(schedule.endMinute)} onChange={(event) => updateSchedule(weekday, { endMinute: timeMinutes(event.target.value), isActive: true })} disabled={!schedule.isActive} className="min-w-0 rounded-lg border border-[#dfd1c8] bg-white px-2 py-2 text-[11px] disabled:opacity-40" /></div>;
            })}</div>
          </fieldset>

          <label className="text-xs font-semibold">Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal"><option value="ACTIVE">Đang làm việc</option><option value="OFF">Tạm nghỉ</option><option value="HIDDEN">Ẩn khỏi vận hành</option></select></label>
          <label className="flex items-center gap-2 rounded-xl border border-[#e7d6ca] bg-white px-3 py-3 text-xs font-semibold"><input type="checkbox" checked={onlineBooking} onChange={(event) => setOnlineBooking(event.target.checked)} /> Cho khách đặt online</label>
          <label className="text-xs font-semibold sm:col-span-2">Ghi chú nội bộ<textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} rows={2} className="mt-1.5 w-full rounded-xl border border-[#dfd1c8] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#c64b32]" /></label>
          {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 sm:col-span-2">{error}</p> : null}
        </div>

        <footer className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-[#e7d6ca] bg-white px-4 py-3 sm:px-5">
          {therapist ? <button type="button" disabled={busy} onClick={() => void deactivate()} className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-700 disabled:opacity-50"><Trash2 size={14} /> Xóa khỏi đặt lịch</button> : <span />}
          <button type="submit" disabled={busy || !serviceIds.length} className="inline-flex items-center gap-1.5 rounded-full bg-[#c64b32] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu & đồng bộ</button>
        </footer>
      </form>
    </div>
  );
}
