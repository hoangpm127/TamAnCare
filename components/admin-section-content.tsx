"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Building2, Check, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { canAccessAdminSection, type AdminSectionSlug } from "@/lib/admin-auth";
import { ADMIN_SECTION_META } from "@/lib/admin-section-config";
import { useAdminSession } from "@/components/admin-session-provider";
import { CompactSelect } from "@/components/compact-select";
import { confirmAdminBookingRequest, registerAdminBookingRequest, useAdminBookingRequests } from "@/lib/admin-booking-store";
import { displayBookingCode, formatMoney } from "@/lib/utils";

export type AdminTableRow = {
  primary: string;
  secondary: string;
  meta: string;
  status: string;
  value: string;
  href?: string;
  branchId?: string;
  workflowStatus?: "NEW" | "CONFIRMED" | "REJECTED";
};

type ManagedRow = AdminTableRow & { __id: string };

function makeManagedRows(rows: AdminTableRow[]) {
  return rows.map((row, index) => ({ ...row, __id: `${row.primary}-${row.secondary}-${index}` }));
}

function AdminRecordDialog({
  section,
  initial,
  branches,
  onClose,
  onSave,
}: {
  section: AdminSectionSlug;
  initial: ManagedRow | null;
  branches: Array<{ id: string; label: string }>;
  onClose: () => void;
  onSave: (row: AdminTableRow) => void;
}) {
  const meta = ADMIN_SECTION_META[section];
  const [primary, setPrimary] = useState(initial?.primary ?? "");
  const [secondary, setSecondary] = useState(initial?.secondary ?? "");
  const [detail, setDetail] = useState(initial?.meta ?? "");
  const [status, setStatus] = useState(initial?.status ?? "Đang hoạt động");
  const [value, setValue] = useState(initial?.value ?? "");
  const [branchId, setBranchId] = useState(initial?.branchId ?? "");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!primary.trim()) return;
    onSave({ primary: primary.trim(), secondary: secondary.trim() || "Chưa cập nhật", meta: detail.trim() || meta.shortDescription, status: status.trim() || "Đang hoạt động", value: value.trim() || "0", branchId: branchId || undefined });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-5">
      <button type="button" className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Đóng" />
      <form onSubmit={submit} className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c64b32]">{initial ? "Chỉnh sửa" : "Thêm mới"}</p><h2 className="mt-0.5 text-lg font-semibold">{meta.label}</h2><p className="mt-0.5 text-[11px] text-[#826f66]">Cập nhật sẽ hiển thị ngay trong phạm vi quản trị hiện tại.</p></div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fbf2e7]" aria-label="Đóng"><X size={16} /></button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="text-xs font-semibold">Tên / Mã</span><input value={primary} onChange={(event) => setPrimary(event.target.value)} required className="mt-1.5 w-full rounded-lg border border-[#e7d6ca] px-3 py-2.5 text-sm" placeholder={`Tên ${meta.label.toLowerCase()}`} /></label>
          <label className="block"><span className="text-xs font-semibold">Trạng thái</span><input value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e7d6ca] px-3 py-2.5 text-sm" /></label>
          <label className="block sm:col-span-2"><span className="text-xs font-semibold">Thông tin</span><input value={secondary} onChange={(event) => setSecondary(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e7d6ca] px-3 py-2.5 text-sm" placeholder="Mô tả ngắn hoặc thông tin liên hệ" /></label>
          <label className="block"><span className="text-xs font-semibold">Chi tiết</span><input value={detail} onChange={(event) => setDetail(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e7d6ca] px-3 py-2.5 text-sm" /></label>
          <label className="block"><span className="text-xs font-semibold">Giá trị</span><input value={value} onChange={(event) => setValue(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e7d6ca] px-3 py-2.5 text-sm" placeholder="Giá, số lượng hoặc ghi chú" /></label>
          <div className="sm:col-span-2"><p className="text-xs font-semibold">Cơ sở áp dụng</p><CompactSelect className="mt-1.5" value={branchId} onValueChange={setBranchId} dialogTitle="Chọn phạm vi áp dụng" triggerClassName="rounded-lg text-sm" options={[{ value: "", label: "Dùng chung toàn hệ thống" }, ...branches.map((branch) => ({ value: branch.id, label: branch.label }))]} /></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={onClose} className="rounded-full border border-[#e7d6ca] px-4 py-2.5 text-sm font-semibold">Hủy</button><button type="submit" className="rounded-full bg-[#c64b32] px-4 py-2.5 text-sm font-semibold text-white">{initial ? "Lưu thay đổi" : "Thêm vào hệ thống"}</button></div>
      </form>
    </div>
  );
}

export function AdminSectionContent({ section, title, rows, branches, beforeTable }: { section: AdminSectionSlug; title: string; rows: AdminTableRow[]; branches: Array<{ id: string; label: string }>; beforeTable?: React.ReactNode }) {
  const { session } = useAdminSession();
  const bookingRequests = useAdminBookingRequests();
  const [managedRows, setManagedRows] = useState<ManagedRow[]>(() => makeManagedRows(rows));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ManagedRow | null>(null);

  const requestCodes = new Set(bookingRequests.map((request) => request.bookingCode));
  const workflowRows: AdminTableRow[] = bookingRequests.map((request) => ({
    primary: request.bookingCode,
    secondary: `${request.customerName} · ${request.customerPhone}`,
    meta: `${request.serviceLabel} · ${new Date(request.timeIso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}`,
    status: request.status === "NEW" ? "Booking mới" : request.status === "CONFIRMED" ? "Đã xác nhận" : "Cần đổi lịch",
    value: formatMoney(request.totalAmount),
    branchId: request.branchId,
    workflowStatus: request.status,
  }));
  const displayedRows = section === "bookings"
    ? makeManagedRows([...workflowRows, ...rows.filter((row) => !requestCodes.has(row.primary))])
    : managedRows;

  if (!session) return null;
  const activeSession = session;

  if (!canAccessAdminSection(session, section)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center sm:px-6">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f8ebe5] text-[#c64b32]"><LockKeyhole size={24} /></span>
        <h1 className="mt-4 text-xl font-semibold">Không thuộc phạm vi được cấp</h1>
        <p className="mt-2 text-sm leading-6 text-[#68574f]">{session.displayName} không có quyền mở mục {title}. Quyền này chỉ dành cho quản trị viên tổng.</p>
        <Link href="/admin" className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#c64b32] px-4 py-2.5 text-sm font-semibold text-white"><ArrowLeft size={15} /> Về tổng quan</Link>
      </div>
    );
  }

  const scopedRows = session.role === "OWNER" ? displayedRows : displayedRows.filter((row) => !row.branchId || row.branchId === session.branchId);
  const displayPrimary = (row: AdminTableRow) => section === "bookings" ? displayBookingCode(row.primary) : row.primary;
  const meta = ADMIN_SECTION_META[section];
  const SectionIcon = meta.icon;

  function persistRows(next: ManagedRow[]) {
    setManagedRows(next);
  }

  function saveRow(row: AdminTableRow) {
    if (section === "bookings") {
      const branchId = activeSession.role === "OWNER" ? row.branchId || branches[0].id : activeSession.branchId ?? branches[0].id;
      const branch = branches.find((item) => item.id === branchId) ?? branches[0];
      registerAdminBookingRequest({
        bookingCode: row.primary,
        customerName: row.secondary,
        customerPhone: "Booking nhập thủ công",
        serviceLabel: row.meta,
        branchId: branch.id,
        branchLabel: branch.label,
        timeIso: new Date().toISOString(),
        totalAmount: Number(row.value.replace(/\D/g, "")) || 0,
        depositAmount: 0,
      });
    } else if (editingRow) {
      persistRows(managedRows.map((item) => item.__id === editingRow.__id ? { ...item, ...row } : item));
    } else {
      const branchId = activeSession.role === "OWNER" ? row.branchId : activeSession.branchId ?? row.branchId;
      persistRows([{ ...row, branchId, __id: `local-${crypto.randomUUID()}` }, ...managedRows]);
    }
    setDialogOpen(false);
    setEditingRow(null);
  }

  async function confirmBooking(row: ManagedRow) {
    await fetch(`/api/bookings/${encodeURIComponent(row.primary)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONFIRMED", paymentStatus: "DEPOSITED" }),
    }).catch(() => undefined);
    confirmAdminBookingRequest(row.primary, activeSession.displayName);
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-10">
      <section className="relative mb-3 overflow-hidden rounded-2xl border border-[#c59a3d]/55 bg-gradient-to-br from-[#fff8e8] via-white to-[#f8ebe5] p-3.5 shadow-sm sm:p-4">
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#c59a3d]/20 blur-2xl" />
        <div className="relative flex flex-col items-center text-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#5c3a1e] text-[#e7c878] shadow-sm"><SectionIcon size={20} /></span>
          <div className="mt-2 min-w-0">
            <p className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c64b32]">
              {session.role === "OWNER" ? <ShieldCheck size={12} /> : <Building2 size={12} />} {session.branchLabel}
            </p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{title}</h1>
            <p className="mx-auto mt-1 max-w-lg text-[11px] leading-4 text-[#715943]">{meta.description}</p>
          </div>
          <span className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-full bg-[#eff7f3] px-2.5 py-1.5 text-[10px] font-semibold text-[#0b5d45]"><Check size={12} /> CSDL</span>
        </div>
        <div className="relative mt-3 flex items-center justify-between gap-3 border-t border-[#c59a3d]/30 pt-2.5 text-[10px] text-[#826f66]">
          <span><strong className="text-sm text-[#281b18]">{scopedRows.length}</strong> bản ghi trong phạm vi</span>
          <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-[#7a3e1d] ring-1 ring-[#c59a3d]/35">{meta.shortDescription}</span>
        </div>
      </section>

      {beforeTable ? <div className="mb-3">{beforeTable}</div> : null}

      <section className="overflow-hidden rounded-xl border border-[#d2ad5d]/60 bg-white shadow-sm ring-1 ring-inset ring-[#fff8ed]">
        {scopedRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#68574f]">Chưa có dữ liệu thuộc {session.branchLabel}.</div>
        ) : (
          <>
            <div className="space-y-2 p-2.5 md:hidden">
              {scopedRows.map((row) => (
                <div key={row.__id} className="overflow-hidden rounded-xl border border-[#d2ad5d]/70 bg-white shadow-[0_1px_8px_rgba(92,58,30,0.04)] ring-1 ring-inset ring-[#fbf2e7]">
                  <div className="p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    {row.href ? <Link href={row.href} className="text-sm font-semibold text-[#c64b32]">{displayPrimary(row)}</Link> : <p className="text-sm font-semibold">{displayPrimary(row)}</p>}
                    <span className="shrink-0 rounded-full bg-[#fbf2e7] px-2 py-1 text-[9px] font-semibold text-[#7a3e1d] ring-1 ring-[#c59a3d]/35">{row.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#68574f]">{row.secondary}</p>
                  <div className="mt-2 grid grid-cols-[1fr_auto] gap-3 border-t border-[#f4ebe5] pt-2 text-[10px]">
                    <span className="min-w-0 text-[#826f66]"><span className="block text-[9px] uppercase tracking-wide">Chi tiết</span><span className="mt-0.5 block truncate">{row.meta}</span></span>
                    <span className="text-right"><span className="block text-[9px] uppercase tracking-wide text-[#826f66]">Giá trị</span><strong className="mt-0.5 block shrink-0 text-[#281b18]">{row.value}</strong></span>
                  </div>
                  {row.branchId ? <p className="mt-1.5 text-[9px] font-semibold text-[#c64b32]">{branches.find((item) => item.id === row.branchId)?.label}</p> : null}
                  {section === "bookings" ? (
                    row.workflowStatus === "NEW" ? <button type="button" onClick={() => void confirmBooking(row)} className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#c64b32] px-3 py-2 text-[11px] font-semibold text-white"><Check size={13} /> Xác nhận lịch</button> : <p className="mt-2 flex items-center justify-center gap-1 text-[10px] font-semibold text-[#18815e]"><Check size={12} /> Đã xử lý và gửi thông báo khách</p>
                  ) : <p className="mt-2 flex items-center justify-end gap-1 border-t border-[#f4ebe5] pt-2 text-[10px] font-semibold text-[#0b5d45]"><Check size={11} /> Dữ liệu máy chủ</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-[#fdf8f3] text-[#68574f]"><tr className="border-b border-[#e7d6ca]"><th className="px-4 py-3">Tên / Mã</th><th>Thông tin</th><th>Chi tiết</th><th>Cơ sở</th><th>Trạng thái</th><th className="text-right">Giá trị</th><th className="pr-4 text-right">Thao tác</th></tr></thead>
                <tbody>{scopedRows.map((row) => (
                  <tr key={row.__id} className="border-b border-[#f2e7df] last:border-0">
                    <td className="px-4 py-3 font-semibold">{row.href ? <Link href={row.href} className="text-[#c64b32]">{displayPrimary(row)}</Link> : displayPrimary(row)}</td><td>{row.secondary}</td><td>{row.meta}</td><td>{row.branchId ? branches.find((item) => item.id === row.branchId)?.label : "Dùng chung"}</td><td><span className="rounded-full bg-[#f8ebe5] px-2 py-1 text-[10px] font-semibold text-[#c64b32]">{row.status}</span></td><td className="text-right font-semibold">{row.value}</td>
                    <td className="pr-4 text-right">{section === "bookings" ? row.workflowStatus === "NEW" ? <button type="button" onClick={() => void confirmBooking(row)} className="rounded-full bg-[#c64b32] px-3 py-1.5 text-[10px] font-semibold text-white">Xác nhận</button> : <span className="text-[10px] font-semibold text-[#18815e]">Đã xử lý</span> : <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0b5d45]"><Check size={11} /> CSDL</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}
      </section>
      {section === "bookings" && dialogOpen ? <AdminRecordDialog key={editingRow?.__id ?? "new"} section={section} initial={editingRow} branches={branches} onClose={() => { setDialogOpen(false); setEditingRow(null); }} onSave={saveRow} /> : null}
    </div>
  );
}
