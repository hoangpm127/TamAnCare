"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useAdminSession } from "@/components/admin-session-provider";
import { CompactSelect } from "@/components/compact-select";
import { usePublicCatalog } from "@/lib/catalog-store";
import { cn, formatMoney } from "@/lib/utils";

type CustomerRecord = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  createdAt: string;
  segment: string;
  groups: string[];
  totalVisits: number;
  totalSpend: number;
  internalNote: string | null;
  firstSource: string | null;
  lastVisitAt: string | null;
  account: {
    registeredAt: string;
    phoneVerified: boolean;
    pinConfigured: boolean;
    affiliateConfigured: boolean;
  } | null;
  favoriteTherapist: { fullName: string } | null;
  packages: Array<{ id: string; planNameSnapshot: string | null; packagePlan: { name: string } }>;
  bookings: Array<{
    id: string;
    branchId: string;
    startTime: string;
    totalAmount: number;
    status: string;
    branch: { name: string };
    service: { name: string };
    therapist: { fullName: string } | null;
  }>;
};

type DirectoryResponse = {
  customers?: CustomerRecord[];
  pagination?: { page: number; pageSize: number; total: number; pageCount: number };
  summary?: { customers: number; visits: number; spend: number };
  error?: string;
};

const emptySummary = { customers: 0, visits: 0, spend: 0 };

function segmentLabel(segment: string) {
  if (segment === "VIP") return "Khách VIP";
  if (segment === "RETURNING") return "Khách thân thiết";
  if (segment === "LONG_TERM") return "Khách mua thẻ dài hạn";
  if (segment === "BUSINESS") return "Khách doanh nghiệp";
  if (segment === "AFFILIATE") return "Đối tác Affiliate";
  return "Khách mới";
}

function displayDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

export function AdminCustomerTimeline() {
  const catalog = usePublicCatalog();
  const branches = catalog.branches;
  const { session } = useAdminSession();
  const [customerRecords, setCustomerRecords] = useState<CustomerRecord[]>([]);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("ALL");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [sort, setSort] = useState("NEWEST");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [summary, setSummary] = useState(emptySummary);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<"summary" | "full">("summary");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    let pollTimer: number | undefined;

    async function load(background = false) {
      if (!background) setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "50",
          query: query.trim(),
          group: segment,
          account: accountFilter,
          sort,
        });
        const response = await fetch(`/api/customers?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json() as DirectoryResponse;
        if (!response.ok) throw new Error(data.error ?? "Không thể tải danh sách khách hàng.");
        setCustomerRecords(data.customers ?? []);
        setSummary(data.summary ?? emptySummary);
        setPageCount(data.pagination?.pageCount ?? 1);
        setError("");
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Không thể tải danh sách khách hàng.");
      } finally {
        if (!background && !controller.signal.aborted) setLoading(false);
      }
    }

    const debounceTimer = window.setTimeout(() => {
      void load();
      pollTimer = window.setInterval(() => void load(true), 15000);
    }, query.trim() ? 250 : 0);

    return () => {
      controller.abort();
      window.clearTimeout(debounceTimer);
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, [accountFilter, page, query, segment, session, sort]);

  const customers = useMemo(() => customerRecords.map((customer) => {
    const latest = customer.bookings[0];
    return {
      ...customer,
      favoriteTherapistName: customer.favoriteTherapist?.fullName ?? latest?.therapist?.fullName ?? "Chưa phân công",
      lastVisit: customer.lastVisitAt
        ? displayDate(customer.lastVisitAt)
        : latest
          ? displayDate(latest.startTime)
          : "Chưa phát sinh lịch",
      note: customer.internalNote || (customer.packages.length
        ? `Đang sử dụng ${customer.packages.map((item) => item.planNameSnapshot ?? item.packagePlan.name).join(", ")}.`
        : "Chưa có ghi chú chăm sóc."),
      branchId: latest?.branchId ?? customer.firstSource?.split(":")[1],
    };
  }), [customerRecords]);

  if (!session) return null;

  return (
    <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#291714] via-[#522417] to-[#93352d] p-3.5 text-white shadow-sm">
        <div className="flex items-center gap-3 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#e7c878] ring-1 ring-white/15"><UsersRound size={18} /></span>
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#e7c878]">{session.role === "OWNER" ? <ShieldCheck size={12} /> : <Building2 size={12} />} {session.branchLabel}</p>
            <h1 className="mt-0.5 text-lg font-semibold">Danh sách khách hàng</h1>
            <p className="mt-0.5 text-[10px] text-white/70">Tất cả tài khoản trên hệ thống, kể cả khách chưa từng đặt lịch.</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 pt-3 text-center">
          <div><strong className="block text-base">{summary.customers}</strong><span className="text-[9px] text-white/60">Khách phù hợp</span></div>
          <div><strong className="block text-base">{summary.visits}</strong><span className="text-[9px] text-white/60">Tổng lượt ghé</span></div>
          <div><strong className="block text-xs text-[#e7c878]">{formatMoney(summary.spend)}</strong><span className="text-[9px] text-white/60">Tổng chi tiêu</span></div>
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-[#d2ad5d]/60 bg-white p-3 shadow-sm">
        <label className="flex items-center gap-2 rounded-xl border border-[#e7d6ca] px-3 py-2.5">
          <Search size={15} className="text-[#c64b32]" />
          <input
            aria-label="Tìm khách hàng"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder="Tìm tên, số điện thoại, email hoặc khu vực Affiliate"
          />
          {loading ? <Loader2 size={14} className="animate-spin text-[#c64b32]" /> : null}
        </label>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <CompactSelect
            value={segment}
            onValueChange={(value) => {
              setSegment(value);
              setPage(1);
            }}
            dialogTitle="Lọc nhóm khách hàng"
            triggerClassName="min-h-0 rounded-lg py-2 text-[11px]"
            options={[
              { value: "ALL", label: "Tất cả nhóm khách" },
              { value: "NEW", label: "Khách mới" },
              { value: "RETURNING", label: "Khách thân thiết" },
              { value: "VIP", label: "Khách VIP" },
              { value: "LONG_TERM", label: "Khách mua thẻ dài hạn" },
              { value: "BUSINESS", label: "Khách doanh nghiệp" },
              { value: "AFFILIATE", label: "Đối tác Affiliate" },
            ]}
          />
          <CompactSelect
            value={accountFilter}
            onValueChange={(value) => {
              setAccountFilter(value);
              setPage(1);
            }}
            dialogTitle="Lọc trạng thái tài khoản"
            triggerClassName="min-h-0 rounded-lg py-2 text-[11px]"
            options={[
              { value: "ALL", label: "Mọi hồ sơ khách" },
              { value: "REGISTERED", label: "Đã có tài khoản" },
              { value: "NO_ACCOUNT", label: "Chưa có tài khoản" },
              { value: "PIN_MISSING", label: "Tài khoản chưa có PIN" },
            ]}
          />
          <CompactSelect
            value={sort}
            onValueChange={(value) => {
              setSort(value);
              setPage(1);
            }}
            dialogTitle="Sắp xếp khách hàng"
            triggerClassName="min-h-0 rounded-lg py-2 text-[11px]"
            options={[
              { value: "NEWEST", label: "Mới đăng ký trước" },
              { value: "VISITS", label: "Nhiều lượt ghé trước" },
              { value: "SPEND", label: "Chi tiêu cao trước" },
            ]}
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[10px] text-[#826f66]">Kết quả được lọc trên toàn bộ dữ liệu khách hàng.</p>
          <div className="flex shrink-0 rounded-lg bg-[#f5eee9] p-0.5">
            <button type="button" onClick={() => setDetailMode("summary")} className={cn("rounded-md px-2 py-1.5 text-[9px] font-semibold", detailMode === "summary" && "bg-white text-[#c64b32] shadow-sm")}>Tóm tắt</button>
            <button type="button" onClick={() => setDetailMode("full")} className={cn("rounded-md px-2 py-1.5 text-[9px] font-semibold", detailMode === "full" && "bg-white text-[#c64b32] shadow-sm")}>Đầy đủ</button>
          </div>
        </div>
        {error ? <p className="mt-2 rounded-lg bg-[#fff1ef] px-3 py-2 text-xs font-medium text-[#9d2e24]">{error}</p> : null}
      </section>

      <section className="mt-3 space-y-3">
        {customers.map((customer) => {
          const isOpen = expanded === customer.id;
          const customerBookings = [...customer.bookings].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
          const latestBranchId = customer.branchId ?? customerBookings[0]?.branchId;
          return (
            <article key={customer.id} className="relative overflow-hidden rounded-2xl border border-[#d2ad5d]/60 bg-white shadow-sm">
              <button type="button" onClick={() => setExpanded(isOpen ? null : customer.id)} className="w-full p-3.5 text-left">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f8ebe5] text-[#c64b32]"><UserRound size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold">{customer.fullName}</h2>
                        <p className="mt-0.5 truncate text-[10px] text-[#826f66]">{customer.phone}{customer.email ? ` · ${customer.email}` : ""}</p>
                        <p className="mt-0.5 text-[9px] text-[#9a877e]">{branches.find((branch) => branch.id === latestBranchId)?.label ?? "Chưa chọn cơ sở"}</p>
                      </div>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fbf2e7] text-[#7a3e1d]">{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {customer.groups.slice(0, 3).map((group) => <span key={group} className="rounded-full bg-[#fff7df] px-2 py-1 text-[9px] font-semibold text-[#76551d]">{segmentLabel(group)}</span>)}
                      <span className={cn("rounded-full px-2 py-1 text-[9px] font-semibold", customer.account ? "bg-[#e8f5ec] text-[#28623c]" : "bg-[#f1efed] text-[#68574f]")}>{customer.account ? "Đã có tài khoản" : "Chưa có tài khoản"}</span>
                      {customer.account && !customer.account.pinConfigured ? <span className="rounded-full bg-[#fff0cf] px-2 py-1 text-[9px] font-semibold text-[#875e14]">Chưa có PIN</span> : null}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-lg bg-[#fdf8f3] py-2"><strong className="block text-xs">{customer.totalVisits}</strong><span className="text-[9px] text-[#826f66]">Lượt ghé</span></div>
                  <div className="rounded-lg bg-[#fdf8f3] py-2"><strong className="block text-xs">{formatMoney(customer.totalSpend)}</strong><span className="text-[9px] text-[#826f66]">Chi tiêu</span></div>
                  <div className="rounded-lg bg-[#fdf8f3] py-2"><strong className="block truncate px-1 text-xs">{customer.favoriteTherapistName}</strong><span className="text-[9px] text-[#826f66]">KTV quen</span></div>
                </div>
              </button>

              {isOpen ? <div className="border-t border-[#e7d6ca] bg-[#fffdfb] p-3.5">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#e7d6ca] bg-white p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold"><Sparkles size={13} className="text-[#c64b32]" /> Nhu cầu & ghi chú</p>
                    <p className="mt-1.5 text-[11px] leading-4 text-[#68574f]">{customer.note}</p>
                  </div>
                  <div className="rounded-xl border border-[#e7d6ca] bg-white p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold"><CircleDollarSign size={13} className="text-[#c64b32]" /> Thông tin chăm sóc</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                      <span className="rounded-lg bg-[#fbf2e7] p-2">Ghé gần nhất<strong className="mt-0.5 block text-xs">{customer.lastVisit}</strong></span>
                      <span className="rounded-lg bg-[#fbf2e7] p-2">Ngày đăng ký<strong className="mt-0.5 block text-xs">{customer.account ? displayDate(customer.account.registeredAt) : displayDate(customer.createdAt)}</strong></span>
                    </div>
                  </div>
                  {detailMode === "full" ? <div className="rounded-xl border border-[#e7d6ca] bg-white p-3 sm:col-span-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold"><CalendarClock size={13} className="text-[#c64b32]" /> Lịch sử phục vụ gần đây</p>
                    <div className="mt-2 space-y-2">
                      {customerBookings.length === 0 ? <p className="text-[10px] text-[#826f66]">Khách chưa phát sinh lịch đặt.</p> : customerBookings.map((booking) => <div key={booking.id} className="rounded-lg bg-[#fdf8f3] p-2.5">
                        <div className="flex justify-between gap-2"><p className="text-[10px] font-semibold">{booking.service.name}</p><span className="text-[9px] text-[#826f66]">{displayDate(booking.startTime)}</span></div>
                        <p className="mt-1 text-[9px] text-[#68574f]">{booking.therapist?.fullName ?? "Cơ sở sắp xếp"} · {formatMoney(booking.totalAmount)} · {booking.status === "COMPLETED" ? "Hoàn thành" : "Đã đặt"}</p>
                      </div>)}
                    </div>
                  </div> : null}
                </div>
                <Link href={`/admin/customers/${customer.id}`} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#c64b32] py-2.5 text-xs font-semibold text-white">Mở hồ sơ và cấp lại PIN <ExternalLink size={13} /></Link>
              </div> : null}
            </article>
          );
        })}
        {!loading && customers.length === 0 ? <div className="rounded-2xl border border-dashed border-[#d2ad5d] bg-white py-10 text-center text-xs text-[#826f66]">Không tìm thấy khách hàng phù hợp.</div> : null}
      </section>

      {pageCount > 1 ? <nav aria-label="Phân trang khách hàng" className="mt-4 flex items-center justify-center gap-3">
        <button type="button" disabled={page === 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="inline-flex items-center gap-1 rounded-full border border-[#d2ad5d] bg-white px-3 py-2 text-xs font-semibold text-[#6f211f] disabled:opacity-40"><ChevronLeft size={14} /> Trang trước</button>
        <span className="text-xs text-[#68574f]">Trang {page}/{pageCount}</span>
        <button type="button" disabled={page === pageCount || loading} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="inline-flex items-center gap-1 rounded-full border border-[#d2ad5d] bg-white px-3 py-2 text-xs font-semibold text-[#6f211f] disabled:opacity-40">Trang sau <ChevronRight size={14} /></button>
      </nav> : null}
    </div>
  );
}
