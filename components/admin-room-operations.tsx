"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock3, Loader2, RefreshCcw, UserRound, WandSparkles } from "lucide-react";
import { CompactSelect } from "@/components/compact-select";
import { useAdminSession } from "@/components/admin-session-provider";
import { cn } from "@/lib/utils";

type RoomLiveStatus = "AVAILABLE" | "BUSY" | "MAINTENANCE";
type RoomView = {
  id: string;
  branchId: string;
  name: string;
  type: string;
  status: string;
  note: string | null;
  liveStatus: RoomLiveStatus;
  currentBooking: null | {
    customerName: string;
    serviceName: string;
    therapistName: string;
    startTime: string;
    endTime: string;
    status: string;
  };
  nextBooking: null | { customerName: string; startTime: string };
};

type RoomPayload = {
  generatedAt: string;
  selectedAt: string;
  branches: Array<{ id: string; label: string; seatCapacity: number }>;
  rooms: RoomView[];
};

function time(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function fullDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function vietnamDateTimeLocal(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function roomName(value: string) {
  return value.replace(/^Ghế\/Giường/i, "Giường");
}

const BED_GROUPS = [
  { type: "HEAD_SPA_BED", label: "Giường gội", tone: "text-[#8d4d76]" },
  { type: "FOOT_CHAIR", label: "Giường Foot", tone: "text-[#9a6322]" },
  { type: "MASSAGE_BED", label: "Giường Body", tone: "text-[#76551d]" },
] as const;

function statusTone(status: RoomLiveStatus) {
  if (status === "AVAILABLE") {
    return {
      card: "border-[#d2ad5d] bg-gradient-to-br from-[#fbf2e7] to-white",
      badge: "bg-[#f1e5dd] text-[#76551d]",
      label: "RẢNH",
    };
  }
  if (status === "BUSY") {
    return {
      card: "border-[#efaaa7] bg-gradient-to-br from-[#fff0ef] to-white",
      badge: "bg-[#ffd8d5] text-[#a32b2b]",
      label: "BẬN",
    };
  }
  return {
    card: "border-[#e6cf91] bg-[#fffaf0]",
    badge: "bg-[#f8e8bd] text-[#76551d]",
    label: "BẢO TRÌ",
  };
}

function SpaceCard({ room, compact = false, label }: { room: RoomView; compact?: boolean; label?: string }) {
  const tone = statusTone(room.liveStatus);
  return (
    <article className={cn("min-w-0 overflow-hidden rounded-xl border shadow-[0_5px_14px_rgba(69,46,35,0.05)]", compact ? "p-2" : "p-2.5", tone.card)}>
      <div className="flex items-center justify-between gap-1.5">
        <h3 className={cn("min-w-0 truncate font-semibold text-[#372c27]", compact ? "text-[10px]" : "text-[11px]")}>{label ?? roomName(room.name)}</h3>
        <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[7px] font-extrabold tracking-wide", tone.badge)}>{tone.label}</span>
      </div>
      {room.currentBooking ? (
        <div className="mt-1.5 border-t border-current/10 pt-1.5">
          <p className="truncate text-[9px] font-semibold text-[#9f292c]"><UserRound size={9} className="mr-1 inline" />{room.currentBooking.customerName}</p>
          <p className="mt-0.5 truncate text-[8px] text-[#68574f]">KTV: {room.currentBooking.therapistName}</p>
          <p className="mt-0.5 truncate text-[8px] text-[#68574f]">{room.currentBooking.serviceName}</p>
          <p className="mt-1 text-[8px] font-semibold text-[#a93434]"><Clock3 size={9} className="mr-1 inline" />{time(room.currentBooking.startTime)}–{time(room.currentBooking.endTime)}</p>
        </div>
      ) : room.nextBooking ? (
        <p className="mt-1.5 truncate border-t border-current/10 pt-1.5 text-[8px] text-[#6f625b]">Tiếp theo {time(room.nextBooking.startTime)} · {room.nextBooking.customerName}</p>
      ) : null}
    </article>
  );
}

export function AdminRoomOperations() {
  const { session } = useAdminSession();
  const [payload, setPayload] = useState<RoomPayload | null>(null);
  const [branchId, setBranchId] = useState("all");
  const [selectedAtLocal, setSelectedAtLocal] = useState(() => vietnamDateTimeLocal());
  const [liveMode, setLiveMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!session) return;
    if (!quiet) setLoading(true);
    try {
      const query = new URLSearchParams();
      if (session.role === "OWNER" && branchId !== "all") query.set("branchId", branchId);
      if (!liveMode && selectedAtLocal) query.set("at", new Date(`${selectedAtLocal}:00+07:00`).toISOString());
      const suffix = query.size ? `?${query.toString()}` : "";
      const response = await fetch(`/api/admin-rooms/status${suffix}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể tải trạng thái phòng.");
      setPayload(data as RoomPayload);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải trạng thái phòng.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [branchId, liveMode, selectedAtLocal, session]);

  useEffect(() => {
    queueMicrotask(() => void load());
    const timer = window.setInterval(() => void load(true), liveMode ? 10_000 : 30_000);
    return () => window.clearInterval(timer);
  }, [liveMode, load]);

  const summary = useMemo(() => {
    const rooms = payload?.rooms ?? [];
    return {
      total: rooms.length,
      available: rooms.filter((room) => room.liveStatus === "AVAILABLE").length,
      busy: rooms.filter((room) => room.liveStatus === "BUSY").length,
      maintenance: rooms.filter((room) => room.liveStatus === "MAINTENANCE").length,
    };
  }, [payload]);

  function resetToNow() {
    setSelectedAtLocal(vietnamDateTimeLocal());
    setLiveMode(true);
  }

  if (!session) return null;

  return (
    <main className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4c191b] via-[#76551d] to-[#a85f29] px-3.5 py-3 text-center text-white shadow-lg">
        <button type="button" onClick={() => void load()} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10" aria-label="Làm mới"><RefreshCcw size={14} className={loading ? "animate-spin" : ""} /></button>
        <h1 className="text-lg font-semibold leading-6">Phòng & Giường</h1>
        <p className="mt-0.5 text-[10px] text-white/75">Quan sát tức thì hoặc xem trước công suất theo ngày, giờ</p>
        <div className="mx-auto mt-2 flex max-w-sm items-center justify-center gap-1.5 text-[9px] font-semibold">
          <span className="rounded-full bg-white/10 px-2 py-1">{summary.total} vị trí</span>
          <span className="rounded-full bg-[#f1e5dd] px-2 py-1 text-[#76551d]">{summary.available} rảnh</span>
          <span className="rounded-full bg-[#ffe0de] px-2 py-1 text-[#9b2929]">{summary.busy} bận</span>
          {summary.maintenance > 0 ? <span className="rounded-full bg-[#ffedbd] px-2 py-1 text-[#76551d]">{summary.maintenance} bảo trì</span> : null}
        </div>
      </section>

      <section className="mt-2.5 rounded-xl border border-[#d2ad5d]/55 bg-white p-2 shadow-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(230px,0.8fr)_auto]">
          <CompactSelect className="min-w-0" value={session.role === "OWNER" ? branchId : session.branchId ?? "all"} onValueChange={setBranchId} disabled={session.role !== "OWNER"} dialogTitle="Chọn sơ đồ cơ sở" triggerClassName="min-h-9 rounded-lg py-2" options={[{ value: "all", label: "Toàn hệ thống" }, ...(payload?.branches ?? []).map((branch) => ({ value: branch.id, label: `${branch.label} · ${branch.seatCapacity} giường` }))]} />
          <label className="flex min-h-9 items-center gap-2 rounded-lg border border-[#e7d8cf] bg-[#fffdfa] px-2.5 text-[10px] font-semibold text-[#5f514a]">
            <CalendarClock size={14} className="shrink-0 text-[#a76b2b]" />
            <input type="datetime-local" value={selectedAtLocal} onChange={(event) => { setSelectedAtLocal(event.target.value); setLiveMode(false); }} className="min-w-0 flex-1 bg-transparent text-[10px] outline-none" aria-label="Chọn ngày giờ xem sơ đồ" />
          </label>
          <button type="button" onClick={resetToNow} className={cn("min-h-9 rounded-lg px-3 text-[10px] font-bold transition", liveMode ? "bg-[#76551d] text-white" : "border border-[#d2ad5d] bg-[#fffaf0] text-[#7a5324]")}><WandSparkles size={13} className="mr-1 inline" />Bây giờ</button>
        </div>
        <div className="mt-1.5 flex items-center justify-between px-0.5 text-[8px] text-[#826f66]">
          <span>{liveMode ? "Đang theo dõi trực tiếp" : `Đang xem trước: ${payload ? fullDateTime(payload.selectedAt) : "..."}`}</span>
          <span>Cập nhật {payload ? time(payload.generatedAt) : "--:--"}</span>
        </div>
      </section>

      {error ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p> : null}
      {loading && !payload ? <div className="mt-3 flex min-h-48 items-center justify-center rounded-2xl border border-[#e7d6ca] bg-white text-[#76551d]"><Loader2 className="mr-2 animate-spin" size={18} /> Đang tải sơ đồ...</div> : null}

      <div className="mt-3 space-y-3">
        {(payload?.branches ?? []).map((branch) => {
          const branchRooms = payload?.rooms.filter((room) => room.branchId === branch.id) ?? [];
          if (!branchRooms.length) return null;
          const configuredTypes = new Set<string>(BED_GROUPS.map((group) => group.type));
          const bedGroups = BED_GROUPS.map((group) => ({
            ...group,
            rooms: branchRooms.filter((room) => room.type === group.type),
          })).filter((group) => group.rooms.length > 0);
          const otherRooms = branchRooms.filter((room) => !configuredTypes.has(room.type));
          return (
            <section key={branch.id} className="rounded-2xl border border-[#d2ad5d]/50 bg-white p-2.5 shadow-sm sm:p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div><h2 className="text-sm font-semibold">{branch.label}</h2><p className="text-[9px] text-[#826f66]">{branchRooms.filter((room) => room.liveStatus === "AVAILABLE").length}/{branchRooms.length} vị trí rảnh tại thời điểm đã chọn</p></div>
                <span className="flex shrink-0 items-center gap-1.5 text-[8px] text-[#826f66]"><i className="h-2 w-2 rounded-sm bg-[#a85f29]" /> Rảnh <i className="h-2 w-2 rounded-sm bg-[#d34a4a]" /> Bận</span>
              </div>
              <div className="space-y-2.5">
                {bedGroups.map((group) => (
                  <div key={group.type} className="min-w-0 rounded-xl bg-[#faf7f4] p-2">
                    <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
                      <p className={cn("text-[9px] font-bold uppercase tracking-[0.14em]", group.tone)}>{group.label}</p>
                      <span className="text-[8px] font-semibold text-[#826f66]">{group.rooms.length} giường</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">{group.rooms.map((room) => <SpaceCard key={room.id} room={room} />)}</div>
                  </div>
                ))}
                {otherRooms.length ? (
                  <div className="min-w-0 rounded-xl bg-[#f8f2ed] p-2">
                    <p className="mb-1.5 px-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b5e36]">Khu vực khác</p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">{otherRooms.map((room) => <SpaceCard key={room.id} room={room} />)}</div>
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
