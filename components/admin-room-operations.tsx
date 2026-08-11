"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BedDouble,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Layers3,
  Loader2,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RefreshCcw,
  Settings2,
  Sparkles,
  UserRound,
  UserX,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { CompactSelect } from "@/components/compact-select";
import { useAdminSession } from "@/components/admin-session-provider";
import {
  BED_TYPE_LABELS,
  BED_TYPE_VALUES,
  FACILITY_LIVE_LABELS,
  FACILITY_STATUS_LABELS,
  FACILITY_STATUS_VALUES,
  SERVICE_CATEGORY_LABELS,
  SERVICE_CATEGORY_VALUES,
  type FacilityBedType,
  type FacilityLiveStatus,
  type FacilityServiceCategory,
  type FacilityStatus,
} from "@/lib/facility";
import { cn } from "@/lib/utils";

type BookingView = {
  id: string;
  branchId: string;
  bookingCode: string;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  therapistId: string | null;
  therapistName: string;
  bedId: string | null;
  startTime: string;
  endTime: string;
  expectedEndAt: string;
  status: string;
  checkedInAt: string | null;
  completedAt: string | null;
};

type BedView = {
  id: string;
  branchId: string;
  facilityRoomId: string | null;
  name: string;
  type: FacilityBedType;
  status: FacilityStatus;
  suitableCategories: FacilityServiceCategory[];
  sortOrder: number;
  note: string | null;
  liveStatus: FacilityLiveStatus;
  currentBooking: BookingView | null;
  cleaningBooking: BookingView | null;
  nextBooking: BookingView | null;
};

type FacilityRoomView = {
  id: string;
  floorId: string;
  name: string;
  status: FacilityStatus;
  sortOrder: number;
  note: string | null;
  virtual: boolean;
  beds: BedView[];
};

type FloorView = {
  id: string;
  branchId: string;
  name: string;
  status: FacilityStatus;
  sortOrder: number;
  note: string | null;
  virtual: boolean;
  rooms: FacilityRoomView[];
};

type AttendanceView = {
  id: string;
  status: "PRESENT" | "LATE" | "ABSENT" | "LEAVE" | "OFF";
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  note: string | null;
};

type TherapistView = {
  id: string;
  branchId: string;
  fullName: string;
  status: string;
  serviceIds: string[];
  schedules: Array<{ weekday: number; startMinute: number; endMinute: number; isActive: boolean }>;
  attendance: AttendanceView | null;
  liveBooking: null | { bookingCode: string; customerName: string; serviceName: string; bedName: string; status: string };
  nextBooking: null | { bookingCode: string; customerName: string; startTime: string };
};

type FacilityPayload = {
  generatedAt: string;
  selectedAt: string;
  canConfigure: boolean;
  branches: Array<{ id: string; label: string; seatCapacity: number }>;
  floors: FloorView[];
  therapists: TherapistView[];
  waitingBookings: BookingView[];
  summary: { total: number; available: number; reserved: number; checkedIn: number; inService: number; cleaning: number; maintenance: number };
};

type EditorTarget =
  | { entity: "FLOOR"; id?: string; branchId?: string }
  | { entity: "ROOM"; id?: string; floorId?: string }
  | { entity: "BED"; id?: string; facilityRoomId?: string };

const LIVE_STYLE: Record<FacilityLiveStatus, { card: string; badge: string; dot: string }> = {
  AVAILABLE: { card: "border-[#79bf8c] bg-[#eef9f1] text-[#145d2d]", badge: "bg-[#14883c] text-white", dot: "bg-[#16a34a]" },
  RESERVED: { card: "border-[#e2b86b] bg-[#fff7df] text-[#76551d]", badge: "bg-[#b87818] text-white", dot: "bg-[#d89728]" },
  CHECKED_IN: { card: "border-[#86addd] bg-[#edf5ff] text-[#174e8f]", badge: "bg-[#2868ad] text-white", dot: "bg-[#3b82f6]" },
  IN_SERVICE: { card: "border-[#d95d4d] bg-[#cf4939] text-white", badge: "bg-white/90 text-[#9f292c]", dot: "bg-[#dc2626]" },
  CLEANING: { card: "border-[#b69ac9] bg-[#f5eff9] text-[#64407c]", badge: "bg-[#7b4a97] text-white", dot: "bg-[#8b5aa6]" },
  MAINTENANCE: { card: "border-[#99a3b1] bg-[#e9edf2] text-[#46505e]", badge: "bg-[#667386] text-white", dot: "bg-[#64748b]" },
};

const ATTENDANCE_LABELS: Record<AttendanceView["status"], string> = {
  PRESENT: "Có mặt",
  LATE: "Đi muộn",
  ABSENT: "Vắng",
  LEAVE: "Nghỉ phép",
  OFF: "Nghỉ ca",
};

function time(value: string | null) {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

function fullDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}

function vietnamDateTimeLocal(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function remaining(expectedEndAt: string) {
  const minutes = Math.ceil((new Date(expectedEndAt).getTime() - Date.now()) / 60_000);
  if (minutes < 0) return `Quá ${Math.abs(minutes)} phút`;
  return `Còn ${Math.max(1, minutes)} phút`;
}

function BedCard({ bed, onOpen }: { bed: BedView; onOpen: () => void }) {
  const style = LIVE_STYLE[bed.liveStatus];
  const booking = bed.currentBooking;
  return (
    <button type="button" onClick={onOpen} className={cn("min-h-[116px] w-full rounded-xl border p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md", style.card)}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-[8px] font-extrabold uppercase tracking-[0.1em] opacity-75">{BED_TYPE_LABELS[bed.type]}</p>
        <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[7px] font-extrabold uppercase", style.badge)}>{FACILITY_LIVE_LABELS[bed.liveStatus]}</span>
      </div>
      <h4 className="mt-0.5 truncate text-sm font-extrabold">{bed.name}</h4>
      {booking ? <div className="mt-2 border-t border-current/20 pt-2"><p className="truncate text-[10px] font-bold"><UserRound size={10} className="mr-1 inline" />{booking.customerName}</p><p className="mt-0.5 truncate text-[8px] font-semibold opacity-85">{booking.serviceName}</p><p className="mt-0.5 truncate text-[8px] opacity-85">KTV {booking.therapistName}</p><p className="mt-1 text-[8px] font-bold"><Clock3 size={9} className="mr-1 inline" />{bed.liveStatus === "IN_SERVICE" ? remaining(booking.expectedEndAt) : `${time(booking.startTime)}–${time(booking.endTime)}`}</p></div> : bed.cleaningBooking ? <div className="mt-2 border-t border-current/20 pt-2"><p className="text-[9px] font-bold">Vừa phục vụ xong</p><p className="mt-1 truncate text-[8px]">{bed.cleaningBooking.customerName} · tự mở sau buffer</p></div> : bed.nextBooking ? <div className="mt-2 border-t border-current/20 pt-2"><p className="text-[8px] opacity-75">Lịch kế tiếp</p><p className="mt-0.5 truncate text-[9px] font-bold">{time(bed.nextBooking.startTime)} · {bed.nextBooking.customerName}</p></div> : <p className="mt-3 text-[9px] font-semibold opacity-80">Chạm để xếp khách hoặc xem chi tiết</p>}
    </button>
  );
}

function FacilityEditor({ target, payload, onClose, onSaved }: { target: EditorTarget; payload: FacilityPayload; onClose: () => void; onSaved: () => Promise<void> }) {
  const existingFloor = target.entity === "FLOOR" && target.id ? payload.floors.find((item) => item.id === target.id) : null;
  const allRooms = payload.floors.flatMap((floor) => floor.rooms.map((room) => ({ ...room, branchId: floor.branchId, floorName: floor.name })));
  const existingRoom = target.entity === "ROOM" && target.id ? allRooms.find((item) => item.id === target.id) : null;
  const allBeds = allRooms.flatMap((room) => room.beds.map((bed) => ({ ...bed, floorId: room.floorId })));
  const existingBed = target.entity === "BED" && target.id ? allBeds.find((item) => item.id === target.id) : null;
  const [name, setName] = useState(existingFloor?.name ?? existingRoom?.name ?? existingBed?.name ?? "");
  const [status, setStatus] = useState<FacilityStatus>(existingFloor?.status ?? existingRoom?.status ?? existingBed?.status ?? "ACTIVE");
  const [sortOrder, setSortOrder] = useState(existingFloor?.sortOrder ?? existingRoom?.sortOrder ?? existingBed?.sortOrder ?? 0);
  const [note, setNote] = useState(existingFloor?.note ?? existingRoom?.note ?? existingBed?.note ?? "");
  const [branchId, setBranchId] = useState(existingFloor?.branchId ?? (target.entity === "FLOOR" ? target.branchId : undefined) ?? payload.branches[0]?.id ?? "");
  const [floorId, setFloorId] = useState(existingRoom?.floorId ?? (target.entity === "ROOM" ? target.floorId : undefined) ?? payload.floors.find((floor) => floor.branchId === branchId && !floor.virtual)?.id ?? "");
  const [facilityRoomId, setFacilityRoomId] = useState(existingBed?.facilityRoomId ?? (target.entity === "BED" ? target.facilityRoomId : undefined) ?? allRooms.find((room) => !room.virtual)?.id ?? "");
  const [type, setType] = useState<FacilityBedType>(existingBed?.type ?? "MASSAGE_BED");
  const [categories, setCategories] = useState<FacilityServiceCategory[]>(existingBed?.suitableCategories ?? ["BODY", "NECK_SHOULDER", "THERAPY", "COMBO"]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const title = target.entity === "FLOOR" ? `${target.id ? "Sửa" : "Thêm"} tầng` : target.entity === "ROOM" ? `${target.id ? "Sửa" : "Thêm"} phòng` : `${target.id ? "Sửa" : "Thêm"} giường/ghế`;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = target.entity === "FLOOR"
      ? { branchId, name, status, sortOrder, note }
      : target.entity === "ROOM"
        ? { floorId, name, status, sortOrder, note }
        : { facilityRoomId, name, type, status, suitableCategories: categories, sortOrder, note };
    try {
      const response = await fetch("/api/admin-facility/structure", { method: target.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity: target.entity, id: target.id, data }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Không thể lưu mặt bằng.");
      await onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu mặt bằng.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!target.id) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin-facility/structure", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity: target.entity, id: target.id }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Không thể xóa dữ liệu.");
      await onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xóa dữ liệu.");
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  }

  function toggleCategory(category: FacilityServiceCategory) {
    setCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category]);
  }

  return <div className="fixed inset-0 z-[90] flex items-end bg-black/50 sm:items-center sm:justify-center sm:p-5"><form onSubmit={submit} className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl sm:max-w-xl sm:rounded-2xl sm:p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#c64b32]">Cấu hình mặt bằng</p><h2 className="mt-1 text-lg font-semibold">{title}</h2><p className="mt-1 text-[10px] leading-4 text-[#826f66]">Mọi thay đổi đều lưu nhật ký. Giường đã có lịch sử sẽ được lưu trữ thay vì xóa cứng.</p></div><button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fbf2e7]" aria-label="Đóng"><X size={17} /></button></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {target.entity === "FLOOR" ? <label className="text-xs font-semibold">Cơ sở<select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] bg-white px-3 py-2.5 text-sm font-normal">{payload.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.label}</option>)}</select></label> : null}
      {target.entity === "ROOM" ? <label className="text-xs font-semibold">Thuộc tầng<select value={floorId} onChange={(event) => setFloorId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] bg-white px-3 py-2.5 text-sm font-normal">{payload.floors.filter((floor) => !floor.virtual).map((floor) => <option key={floor.id} value={floor.id}>{payload.branches.find((branch) => branch.id === floor.branchId)?.label} · {floor.name}</option>)}</select></label> : null}
      {target.entity === "BED" ? <label className="text-xs font-semibold">Thuộc phòng<select value={facilityRoomId} onChange={(event) => setFacilityRoomId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] bg-white px-3 py-2.5 text-sm font-normal">{allRooms.filter((room) => !room.virtual).map((room) => <option key={room.id} value={room.id}>{room.floorName} · {room.name}</option>)}</select></label> : null}
      <label className="text-xs font-semibold">Tên hiển thị<input required value={name} onChange={(event) => setName(event.target.value)} placeholder={target.entity === "FLOOR" ? "Tầng 2" : target.entity === "ROOM" ? "Phòng Body 201" : "Giường B01"} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] px-3 py-2.5 text-sm font-normal" /></label>
      {target.entity === "BED" ? <label className="text-xs font-semibold">Loại giường/ghế<select value={type} onChange={(event) => setType(event.target.value as FacilityBedType)} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] bg-white px-3 py-2.5 text-sm font-normal">{BED_TYPE_VALUES.map((value) => <option key={value} value={value}>{BED_TYPE_LABELS[value]}</option>)}</select></label> : null}
      <label className="text-xs font-semibold">Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value as FacilityStatus)} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] bg-white px-3 py-2.5 text-sm font-normal">{FACILITY_STATUS_VALUES.map((value) => <option key={value} value={value}>{FACILITY_STATUS_LABELS[value]}</option>)}</select></label>
      <label className="text-xs font-semibold">Thứ tự hiển thị<input type="number" min="0" max="999" value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] px-3 py-2.5 text-sm font-normal" /></label>
      {target.entity === "BED" ? <fieldset className="sm:col-span-2"><legend className="text-xs font-semibold">Nhóm dịch vụ phù hợp</legend><div className="mt-2 flex flex-wrap gap-1.5">{SERVICE_CATEGORY_VALUES.map((category) => <button key={category} type="button" onClick={() => toggleCategory(category)} className={cn("rounded-full border px-2.5 py-1.5 text-[9px] font-semibold", categories.includes(category) ? "border-[#c64b32] bg-[#f8ebe5] text-[#9f292c]" : "border-[#e7d6ca] text-[#68574f]")}><Check size={10} className={cn("mr-1 inline", !categories.includes(category) && "opacity-0")} />{SERVICE_CATEGORY_LABELS[category]}</button>)}</div></fieldset> : null}
      <label className="text-xs font-semibold sm:col-span-2">Ghi chú<textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1.5 w-full resize-none rounded-xl border border-[#e7d6ca] p-3 text-sm font-normal" placeholder="Vị trí, đặc điểm riêng, lý do bảo trì..." /></label>
    </div>
    {error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p> : null}
    <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={onClose} className="rounded-full border border-[#e7d6ca] py-2.5 text-xs font-semibold">Hủy</button><button disabled={saving || (target.entity === "BED" && categories.length === 0)} className="rounded-full bg-[#c64b32] py-2.5 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu thay đổi"}</button></div>
    {target.id ? <div className="mt-3 border-t border-[#f0e3da] pt-3">{confirmDelete ? <div className="rounded-xl bg-[#fff1ef] p-3"><p className="text-[10px] font-semibold text-[#9f292c]">Xác nhận loại bỏ {name}? Cấp có dữ liệu con sẽ không được xóa.</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg border border-[#e7d6ca] py-2 text-[10px] font-semibold">Giữ lại</button><button type="button" disabled={saving} onClick={() => void remove()} className="rounded-lg bg-[#9f292c] py-2 text-[10px] font-semibold text-white">Xác nhận loại bỏ</button></div></div> : <button type="button" onClick={() => setConfirmDelete(true)} className="w-full rounded-xl border border-[#efaaa7] py-2.5 text-[10px] font-semibold text-[#a32b2b]">Loại bỏ khỏi mặt bằng</button>}</div> : null}
  </form></div>;
}

function BedActionDrawer({ bed, payload, liveMode, onClose, onChanged, onEdit }: { bed: BedView; payload: FacilityPayload; liveMode: boolean; onClose: () => void; onChanged: () => Promise<void>; onEdit: () => void }) {
  const candidates = payload.waitingBookings.filter((booking) =>
    booking.branchId === bed.branchId
    && booking.status !== "PENDING"
    && bed.suitableCategories.includes(booking.serviceCategory as FacilityServiceCategory));
  const initialBooking = bed.currentBooking?.id ?? candidates.find((item) => item.status === "CHECKED_IN")?.id ?? candidates[0]?.id ?? "";
  const [bookingId, setBookingId] = useState(initialBooking);
  const selectedBooking = payload.waitingBookings.find((item) => item.id === bookingId) ?? bed.currentBooking;
  const eligibleTherapists = payload.therapists.filter((therapist) => therapist.branchId === bed.branchId && therapist.status === "ACTIVE" && (!selectedBooking || therapist.serviceIds.includes(selectedBooking.serviceId)));
  const [therapistId, setTherapistId] = useState(selectedBooking?.therapistId ?? eligibleTherapists[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function transition(status: "CHECKED_IN" | "IN_SERVICE") {
    if (!selectedBooking) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(selectedBooking.bookingCode)}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Không thể chuyển trạng thái booking.");
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể chuyển trạng thái booking.");
    } finally {
      setBusy(false);
    }
  }

  async function assign(startAfter = false) {
    if (!selectedBooking || !therapistId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin-facility/assignment", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: selectedBooking.id, bedId: bed.id, therapistId }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Không thể điều phối giường và KTV.");
      if (startAfter) {
        const startResponse = await fetch(`/api/bookings/${encodeURIComponent(selectedBooking.bookingCode)}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "IN_SERVICE" }) });
        const startResult = await startResponse.json().catch(() => ({}));
        if (!startResponse.ok) throw new Error(startResult.error ?? "Đã xếp giường nhưng chưa thể bắt đầu ca.");
      }
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể điều phối giường và KTV.");
    } finally {
      setBusy(false);
    }
  }

  const style = LIVE_STYLE[bed.liveStatus];
  return <div className="fixed inset-0 z-[85] flex items-end bg-black/50 sm:items-center sm:justify-center sm:p-5"><section className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl sm:max-w-xl sm:rounded-2xl sm:p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#c64b32]">Điều phối tại quầy</p><h2 className="mt-1 text-lg font-semibold">{bed.name}</h2><span className={cn("mt-2 inline-flex rounded-full px-2.5 py-1 text-[9px] font-bold", style.badge)}>{FACILITY_LIVE_LABELS[bed.liveStatus]}</span></div><button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fbf2e7]" aria-label="Đóng"><X size={17} /></button></div>
    {!liveMode ? <p className="mt-3 rounded-xl bg-[#fff7df] p-3 text-[10px] font-semibold text-[#76551d]">Bạn đang xem thời điểm dự báo. Hãy bấm “Bây giờ” để thao tác vận hành.</p> : null}
    {bed.currentBooking ? <div className="mt-4 rounded-2xl border border-[#e7d6ca] bg-[#fffaf4] p-3"><p className="text-sm font-bold">{bed.currentBooking.customerName}</p><p className="mt-1 text-[10px] text-[#68574f]">{bed.currentBooking.customerPhone} · {bed.currentBooking.bookingCode}</p><p className="mt-2 text-xs font-semibold">{bed.currentBooking.serviceName}</p><p className="mt-1 text-[10px] text-[#826f66]">{time(bed.currentBooking.startTime)}–{time(bed.currentBooking.endTime)} · KTV {bed.currentBooking.therapistName}</p></div> : null}
    {liveMode && !["IN_SERVICE", "CLEANING", "MAINTENANCE"].includes(bed.liveStatus) ? <div className="mt-4 space-y-3">
      <label className="block text-xs font-semibold">Booking cần xếp<select value={bookingId} onChange={(event) => { setBookingId(event.target.value); const booking = payload.waitingBookings.find((item) => item.id === event.target.value); const eligible = payload.therapists.filter((therapist) => therapist.branchId === bed.branchId && therapist.status === "ACTIVE" && (!booking || therapist.serviceIds.includes(booking.serviceId))); setTherapistId(booking?.therapistId ?? eligible[0]?.id ?? ""); }} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] bg-white px-3 py-2.5 text-sm font-normal"><option value="">Chọn khách đang chờ</option>{candidates.map((booking) => <option key={booking.id} value={booking.id}>{booking.status === "CHECKED_IN" ? "ĐÃ ĐẾN" : "ĐÃ ĐẶT"} · {booking.customerName} · {booking.serviceName}</option>)}</select></label>
      <label className="block text-xs font-semibold">Kỹ thuật viên<select value={therapistId} onChange={(event) => setTherapistId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e7d6ca] bg-white px-3 py-2.5 text-sm font-normal"><option value="">Chọn KTV</option>{eligibleTherapists.map((therapist) => <option key={therapist.id} value={therapist.id}>{therapist.fullName}{therapist.attendance?.checkInAt && !therapist.attendance.checkOutAt ? " · đang có mặt" : ""}</option>)}</select></label>
      {selectedBooking?.status === "CONFIRMED" ? <button disabled={busy} type="button" onClick={() => void transition("CHECKED_IN")} className="w-full rounded-full bg-[#2868ad] py-3 text-xs font-semibold text-white disabled:opacity-50"><LogIn size={14} className="mr-1.5 inline" />Khách đã đến · Check-in</button> : null}
      {selectedBooking?.status === "CHECKED_IN" ? <div className="grid grid-cols-[0.9fr_1.1fr] gap-2"><button disabled={busy || !therapistId} type="button" onClick={() => void assign(false)} className="rounded-full border border-[#c64b32] py-3 text-xs font-semibold text-[#c64b32] disabled:opacity-50">Chỉ xếp vị trí</button><button disabled={busy || !therapistId} type="button" onClick={() => void assign(true)} className="rounded-full bg-[#c64b32] py-3 text-xs font-semibold text-white disabled:opacity-50"><CheckCircle2 size={14} className="mr-1 inline" />Lên giường & bắt đầu</button></div> : selectedBooking && selectedBooking.status !== "CONFIRMED" ? <button disabled={busy || !therapistId} type="button" onClick={() => void assign(false)} className="w-full rounded-full bg-[#c64b32] py-3 text-xs font-semibold text-white disabled:opacity-50">Lưu điều phối</button> : null}
    </div> : null}
    {bed.liveStatus === "IN_SERVICE" ? <div className="mt-4"><p className="rounded-xl bg-[#f8ebe5] p-3 text-[10px] leading-4 text-[#7c171a]">Ca đang chạy. Khi kết thúc, lễ tân thu phần tiền còn lại rồi xác nhận check-out trong Đặt lịch.</p><Link href="/admin/bookings" className="mt-3 flex w-full items-center justify-center rounded-full bg-[#76551d] py-3 text-xs font-semibold text-white">Mở thu tiền & check-out</Link></div> : null}
    {bed.liveStatus === "CLEANING" ? <p className="mt-4 rounded-xl bg-[#f5eff9] p-3 text-[10px] leading-4 text-[#64407c]">Giường đang trong thời gian đệm vệ sinh. Hệ thống tự chuyển về Sẵn sàng khi hết buffer của cơ sở.</p> : null}
    {bed.liveStatus === "MAINTENANCE" ? <p className="mt-4 rounded-xl bg-[#edf0f4] p-3 text-[10px] leading-4 text-[#46505e]">Vị trí hoặc cấp cha đang bảo trì/ngừng sử dụng nên không được thuật toán xếp lịch.</p> : null}
    {error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p> : null}
    {payload.canConfigure ? <button type="button" onClick={onEdit} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#e7d6ca] py-2.5 text-[10px] font-semibold"><Settings2 size={13} />Sửa cấu hình giường/ghế</button> : null}
  </section></div>;
}

export function AdminRoomOperations() {
  const { session } = useAdminSession();
  const [payload, setPayload] = useState<FacilityPayload | null>(null);
  const [branchId, setBranchId] = useState("all");
  const [selectedAtLocal, setSelectedAtLocal] = useState(() => vietnamDateTimeLocal());
  const [liveMode, setLiveMode] = useState(true);
  const [tab, setTab] = useState<"BOARD" | "ATTENDANCE" | "STRUCTURE">("BOARD");
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditorTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!session) return;
    if (!quiet) setLoading(true);
    try {
      const query = new URLSearchParams();
      if (session.role === "OWNER" && branchId !== "all") query.set("branchId", branchId);
      if (!liveMode && selectedAtLocal) query.set("at", new Date(`${selectedAtLocal}:00+07:00`).toISOString());
      const response = await fetch(`/api/admin-rooms/status${query.size ? `?${query}` : ""}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể tải sơ đồ cơ sở.");
      setPayload(data as FacilityPayload);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải sơ đồ cơ sở.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [branchId, liveMode, selectedAtLocal, session]);

  useEffect(() => {
    queueMicrotask(() => void load());
    const timer = window.setInterval(() => void load(true), liveMode && tab !== "STRUCTURE" ? 5_000 : 30_000);
    return () => window.clearInterval(timer);
  }, [liveMode, load, tab]);

  const selectedBed = useMemo(() => payload?.floors.flatMap((floor) => floor.rooms.flatMap((room) => room.beds)).find((bed) => bed.id === selectedBedId) ?? null, [payload, selectedBedId]);

  async function attendance(therapistId: string, action: "CHECK_IN" | "CHECK_OUT" | "MARK_ABSENT" | "MARK_LEAVE" | "MARK_OFF") {
    setError("");
    try {
      const response = await fetch("/api/admin-attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ therapistId, action }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Không thể cập nhật điểm danh.");
      await load(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật điểm danh.");
    }
  }

  if (!session) return null;
  const canConfigure = payload?.canConfigure ?? ["OWNER", "BRANCH_MANAGER"].includes(session.role);
  const visibleFloors = payload?.floors.filter((floor) => branchId === "all" || floor.branchId === branchId) ?? [];

  return <main className="mx-auto max-w-[1500px] px-3 py-3 sm:px-5 sm:py-5 lg:px-8">
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4c191b] via-[#8e2d22] to-[#d45832] px-3.5 py-3 text-center text-white shadow-lg">
      <button type="button" onClick={() => void load()} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10" aria-label="Làm mới"><RefreshCcw size={14} className={loading ? "animate-spin" : ""} /></button>
      <h1 className="text-lg font-semibold">Trung tâm điều phối mặt bằng</h1><p className="mt-0.5 text-[10px] text-white/75">Tầng → Phòng → Giường · một màn hình cho toàn bộ ca vận hành</p>
      <div className="mx-auto mt-2 flex max-w-4xl flex-wrap items-center justify-center gap-1.5 text-[9px] font-semibold">
        {payload ? <><span className="rounded-full bg-white/10 px-2.5 py-1">{payload.summary.total} vị trí</span><span className="rounded-full bg-[#e9f8ed] px-2.5 py-1 text-[#14642f]">{payload.summary.available} sẵn sàng</span><span className="rounded-full bg-[#fff0c8] px-2.5 py-1 text-[#8a5a13]">{payload.summary.reserved} đã đặt</span><span className="rounded-full bg-[#dcecff] px-2.5 py-1 text-[#245c99]">{payload.summary.checkedIn} đã đến</span><span className="rounded-full bg-[#ffe1dd] px-2.5 py-1 text-[#9f292c]">{payload.summary.inService} phục vụ</span><span className="rounded-full bg-[#f0e5f6] px-2.5 py-1 text-[#64407c]">{payload.summary.cleaning} vệ sinh</span><span className="rounded-full bg-[#e4e8ed] px-2.5 py-1 text-[#4e5a69]">{payload.summary.maintenance} tạm khóa</span></> : null}
      </div>
    </section>

    <section className="mt-2.5 rounded-xl border border-[#d2ad5d]/55 bg-white p-2 shadow-sm">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)_auto]">
        <CompactSelect value={session.role === "OWNER" ? branchId : session.branchId ?? "all"} onValueChange={setBranchId} disabled={session.role !== "OWNER"} dialogTitle="Chọn cơ sở" triggerClassName="min-h-9 rounded-lg py-2" options={[{ value: "all", label: "Toàn hệ thống" }, ...(payload?.branches ?? []).map((branch) => ({ value: branch.id, label: `${branch.label} · ${branch.seatCapacity} vị trí` }))]} />
        <label className="flex min-h-9 items-center gap-2 rounded-lg border border-[#e7d8cf] bg-[#fffdfa] px-2.5 text-[10px] font-semibold text-[#5f514a]"><CalendarClock size={14} className="shrink-0 text-[#a76b2b]" /><input type="datetime-local" value={selectedAtLocal} onChange={(event) => { setSelectedAtLocal(event.target.value); setLiveMode(false); }} className="min-w-0 flex-1 bg-transparent text-[10px] outline-none" /></label>
        <button type="button" onClick={() => { setSelectedAtLocal(vietnamDateTimeLocal()); setLiveMode(true); }} className={cn("min-h-9 rounded-lg px-3 text-[10px] font-bold", liveMode ? "bg-[#76551d] text-white" : "border border-[#d2ad5d] bg-[#fffaf0] text-[#7a5324]")}><Sparkles size={13} className="mr-1 inline" />Bây giờ</button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-xl bg-[#f8f3ee] p-1">{(["BOARD", "ATTENDANCE", "STRUCTURE"] as const).map((value) => { const label = value === "BOARD" ? "Sơ đồ vận hành" : value === "ATTENDANCE" ? "Điểm danh KTV" : "Cấu hình mặt bằng"; if (value === "STRUCTURE" && !canConfigure) return null; return <button key={value} type="button" onClick={() => setTab(value)} className={cn("rounded-lg px-2 py-2 text-[9px] font-bold", tab === value ? "bg-white text-[#9f292c] shadow-sm" : "text-[#826f66]")}>{label}</button>; })}</div>
      <div className="mt-1.5 flex items-center justify-between px-0.5 text-[8px] text-[#826f66]"><span>{liveMode ? "Đang theo dõi trực tiếp" : `Đang xem: ${payload ? fullDateTime(payload.selectedAt) : "..."}`}</span><span>Cập nhật {payload ? time(payload.generatedAt) : "--:--"}</span></div>
    </section>

    {error ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p> : null}
    {loading && !payload ? <div className="mt-3 flex min-h-52 items-center justify-center rounded-2xl border border-[#e7d6ca] bg-white text-[#76551d]"><Loader2 className="mr-2 animate-spin" size={18} />Đang đồng bộ sơ đồ...</div> : null}

    {tab === "BOARD" ? <div className="mt-3 space-y-4">
      <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-xl border border-[#eadcd2] bg-white px-3 py-2 text-[8px] font-semibold text-[#68574f]">{Object.entries(FACILITY_LIVE_LABELS).map(([value, label]) => <span key={value} className="flex items-center gap-1"><i className={cn("h-2 w-2 rounded-full", LIVE_STYLE[value as FacilityLiveStatus].dot)} />{label}</span>)}</div>
      {(payload?.branches ?? []).filter((branch) => branchId === "all" || branch.id === branchId).map((branch) => {
        const floors = visibleFloors.filter((floor) => floor.branchId === branch.id && floor.status !== "HIDDEN");
        return <section key={branch.id} className="rounded-2xl border border-[#d2ad5d]/55 bg-[#fffdfb] p-2.5 shadow-sm sm:p-3"><div className="mb-3 flex items-center justify-between gap-3 px-1"><div><h2 className="flex items-center gap-1.5 text-sm font-bold"><Building2 size={15} className="text-[#c64b32]" />{branch.label}</h2><p className="mt-0.5 text-[9px] text-[#826f66]">{floors.length} tầng · {floors.reduce((sum, floor) => sum + floor.rooms.filter((room) => room.status !== "HIDDEN").length, 0)} phòng</p></div><span className="rounded-full bg-[#291714] px-2.5 py-1 text-[9px] font-semibold text-white">{branch.seatCapacity} vị trí hoạt động</span></div>
          <div className="space-y-3">{floors.map((floor) => { const rooms = floor.rooms.filter((room) => room.status !== "HIDDEN"); const beds = rooms.flatMap((room) => room.beds.filter((bed) => bed.status !== "HIDDEN")); return <div key={floor.id} className="grid gap-2 lg:grid-cols-[150px_minmax(0,1fr)]"><aside className="flex min-h-24 flex-col justify-center rounded-2xl bg-gradient-to-br from-[#4b1e11] to-[#743316] p-3 text-center text-[#f1cf75] shadow-sm"><Layers3 className="mx-auto" size={18} /><h3 className="mt-1 text-base font-extrabold">{floor.name}</h3><p className="mt-1 text-[8px] text-white/65">{rooms.length} phòng · {beds.length} vị trí</p>{floor.status !== "ACTIVE" ? <span className="mx-auto mt-2 rounded-full bg-white/10 px-2 py-1 text-[7px] font-bold text-white">{FACILITY_STATUS_LABELS[floor.status]}</span> : null}</aside><div className="min-w-0 space-y-2">{rooms.map((room) => <article key={room.id} className={cn("min-w-0 rounded-2xl border bg-white p-2.5 shadow-sm", room.status === "ACTIVE" ? "border-[#e4d2c4]" : "border-[#abb3bd] bg-[#f1f3f5]")}><header className="mb-2 flex items-center justify-between gap-2"><div className="min-w-0"><p className="flex items-center gap-1 truncate text-[10px] font-extrabold"><DoorOpen size={12} className="text-[#c64b32]" />{room.name}</p><p className="mt-0.5 text-[8px] text-[#826f66]">{room.beds.filter((bed) => bed.status !== "HIDDEN").length} giường/ghế</p></div>{room.status !== "ACTIVE" ? <Wrench size={13} className="shrink-0 text-[#667386]" /> : null}</header><div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">{room.beds.filter((bed) => bed.status !== "HIDDEN").map((bed) => <BedCard key={bed.id} bed={bed} onOpen={() => setSelectedBedId(bed.id)} />)}</div>{room.beds.filter((bed) => bed.status !== "HIDDEN").length === 0 ? <p className="rounded-xl border border-dashed border-[#d8cbc2] p-5 text-center text-[9px] text-[#826f66]">Phòng chưa có giường</p> : null}</article>)}</div></div>; })}</div>
        </section>;
      })}
    </div> : null}

    {tab === "ATTENDANCE" ? <div className="mt-3 space-y-3">{(payload?.branches ?? []).filter((branch) => branchId === "all" || branch.id === branchId).map((branch) => { const therapists = payload?.therapists.filter((item) => item.branchId === branch.id) ?? []; const present = therapists.filter((item) => item.attendance?.checkInAt && !item.attendance.checkOutAt).length; return <section key={branch.id} className="rounded-2xl border border-[#d2ad5d]/55 bg-white p-3 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-1.5 text-sm font-bold"><UsersRound size={15} className="text-[#c64b32]" />Điểm danh · {branch.label}</h2><p className="mt-0.5 text-[9px] text-[#826f66]">Lễ tân ghi nhận; bắt đầu dịch vụ sẽ tự vào ca nếu còn thiếu.</p></div><span className="rounded-full bg-[#e9f8ed] px-2.5 py-1 text-[9px] font-bold text-[#14642f]">{present}/{therapists.length} đang có mặt</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{therapists.map((therapist) => { const record = therapist.attendance; const active = record?.checkInAt && !record.checkOutAt; const completed = record?.checkInAt && record.checkOutAt; return <article key={therapist.id} className={cn("rounded-xl border p-3", active ? "border-[#79bf8c] bg-[#eef9f1]" : completed ? "border-[#d2ad5d] bg-[#fffaf0]" : "border-[#ddd4ce] bg-[#faf8f6]")}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-bold">{therapist.fullName}</p><p className="mt-0.5 truncate text-[8px] text-[#826f66]">{therapist.liveBooking ? `${therapist.liveBooking.serviceName} · ${therapist.liveBooking.bedName}` : "Chưa có ca đang phục vụ"}</p></div><span className={cn("shrink-0 rounded-full px-2 py-1 text-[7px] font-bold", active ? "bg-[#14883c] text-white" : record?.status === "LATE" ? "bg-[#b87818] text-white" : "bg-[#e7e1dd] text-[#68574f]")}>{record ? ATTENDANCE_LABELS[record.status] : "Chưa điểm danh"}</span></div>{record ? <div className="mt-2 grid grid-cols-2 gap-1.5 text-center"><div className="rounded-lg bg-white/70 p-1.5"><span className="block text-[7px] text-[#826f66]">Vào ca</span><b className="text-[9px]">{time(record.checkInAt)}</b></div><div className="rounded-lg bg-white/70 p-1.5"><span className="block text-[7px] text-[#826f66]">Ra ca</span><b className="text-[9px]">{time(record.checkOutAt)}</b></div></div> : null}<div className="mt-2 grid grid-cols-3 gap-1.5">{active ? <button type="button" onClick={() => void attendance(therapist.id, "CHECK_OUT")} className="col-span-3 rounded-lg bg-[#76551d] py-2 text-[9px] font-semibold text-white"><LogOut size={11} className="mr-1 inline" />Ra ca</button> : <button type="button" onClick={() => void attendance(therapist.id, "CHECK_IN")} className="col-span-3 rounded-lg bg-[#14883c] py-2 text-[9px] font-semibold text-white"><LogIn size={11} className="mr-1 inline" />Ghi nhận vào ca</button>}{!active ? <><button type="button" onClick={() => void attendance(therapist.id, "MARK_ABSENT")} className="rounded-lg border border-[#e7d6ca] py-1.5 text-[8px] font-semibold text-[#9f292c]"><UserX size={10} className="mr-1 inline" />Vắng</button><button type="button" onClick={() => void attendance(therapist.id, "MARK_LEAVE")} className="rounded-lg border border-[#e7d6ca] py-1.5 text-[8px] font-semibold text-[#68574f]">Nghỉ phép</button><button type="button" onClick={() => void attendance(therapist.id, "MARK_OFF")} className="rounded-lg border border-[#e7d6ca] py-1.5 text-[8px] font-semibold text-[#68574f]">Nghỉ ca</button></> : null}</div></article>; })}</div></section>; })}</div> : null}

    {tab === "STRUCTURE" && canConfigure ? <div className="mt-3 space-y-3"><div className="flex items-center justify-between gap-3 rounded-2xl border border-[#d2ad5d]/55 bg-white p-3 shadow-sm"><div><h2 className="text-sm font-bold">Cấu hình Tầng → Phòng → Giường</h2><p className="mt-0.5 text-[9px] text-[#826f66]">Ẩn/bảo trì sẽ loại tài nguyên khỏi thuật toán xếp lịch và tự cập nhật công suất.</p></div><button type="button" onClick={() => setEditing({ entity: "FLOOR", branchId: branchId !== "all" ? branchId : payload?.branches[0]?.id })} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#c64b32] px-3 py-2.5 text-[9px] font-semibold text-white"><Plus size={12} />Thêm tầng</button></div>{visibleFloors.map((floor) => <section key={floor.id} className={cn("rounded-2xl border bg-white p-3 shadow-sm", floor.status === "HIDDEN" ? "border-[#c7c0bb] opacity-70" : "border-[#d2ad5d]/55")}><div className="flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-1.5 text-sm font-bold"><Layers3 size={14} className="text-[#a85f29]" />{floor.name}</h3><p className="mt-0.5 text-[8px] text-[#826f66]">{FACILITY_STATUS_LABELS[floor.status]} · thứ tự {floor.sortOrder}</p></div><div className="flex gap-1.5">{!floor.virtual ? <button type="button" onClick={() => setEditing({ entity: "FLOOR", id: floor.id })} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e7d6ca] text-[#c64b32]" aria-label={`Sửa ${floor.name}`}><Pencil size={12} /></button> : null}<button type="button" disabled={floor.virtual} onClick={() => setEditing({ entity: "ROOM", floorId: floor.id })} className="inline-flex items-center gap-1 rounded-lg bg-[#291714] px-2.5 text-[8px] font-semibold text-white disabled:opacity-40"><Plus size={11} />Phòng</button></div></div><div className="mt-3 grid gap-2 lg:grid-cols-2">{floor.rooms.map((room) => <article key={room.id} className={cn("rounded-xl border p-2.5", room.status === "HIDDEN" ? "border-[#c7c0bb] bg-[#f1efed]" : "border-[#e7d6ca] bg-[#fffaf4]")}><div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-bold">{room.name}</p><p className="mt-0.5 text-[8px] text-[#826f66]">{FACILITY_STATUS_LABELS[room.status]} · {room.beds.length} vị trí</p></div><div className="flex gap-1">{!room.virtual ? <button type="button" onClick={() => setEditing({ entity: "ROOM", id: room.id })} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#c64b32]" aria-label={`Sửa ${room.name}`}><Pencil size={11} /></button> : null}<button type="button" disabled={room.virtual} onClick={() => setEditing({ entity: "BED", facilityRoomId: room.id })} className="flex h-7 items-center gap-1 rounded-lg bg-[#c64b32] px-2 text-[8px] font-semibold text-white disabled:opacity-40"><Plus size={10} />Giường</button></div></div><div className="mt-2 flex flex-wrap gap-1.5">{room.beds.map((bed) => <button key={bed.id} type="button" onClick={() => setEditing({ entity: "BED", id: bed.id })} className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[8px] font-semibold", bed.status === "ACTIVE" ? "border-[#d2ad5d] bg-white text-[#76551d]" : "border-[#b9bec5] bg-[#e9edf2] text-[#5d6875]")} aria-label={`Sửa ${bed.name}`}><BedDouble size={10} />{bed.name}<Pencil size={9} className="opacity-60" /></button>)}</div></article>)}</div></section>)}</div> : null}

    {selectedBed && payload ? <BedActionDrawer key={`${selectedBed.id}:${selectedBed.currentBooking?.id ?? "empty"}`} bed={selectedBed} payload={payload} liveMode={liveMode} onClose={() => setSelectedBedId(null)} onChanged={() => load(true)} onEdit={() => { setSelectedBedId(null); setEditing({ entity: "BED", id: selectedBed.id }); }} /> : null}
    {editing && payload ? <FacilityEditor key={`${editing.entity}:${editing.id ?? (editing.entity === "FLOOR" ? editing.branchId : editing.entity === "ROOM" ? editing.floorId : editing.facilityRoomId) ?? "new"}`} target={editing} payload={payload} onClose={() => setEditing(null)} onSaved={() => load(true)} /> : null}
  </main>;
}
