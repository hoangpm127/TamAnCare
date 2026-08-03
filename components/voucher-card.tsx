"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock, Copy, Percent, Tag } from "lucide-react";
import type { CatalogVoucher } from "@/lib/catalog-types";
import { cn, formatMoney } from "@/lib/utils";
import { useVoucherInventory } from "@/lib/voucher-inventory";

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function VoucherCard({ voucher, className, compact, showAllLink = false }: { voucher: CatalogVoucher; className?: string; compact?: boolean; showAllLink?: boolean }) {
  const [copied, setCopied] = useState(false);
  const inventory = useVoucherInventory();
  const inventoryItem = inventory[voucher.code];
  const remaining = inventoryItem?.remaining;
  const available = remaining === null || (remaining ?? 0) > 0;
  const remainingLabel = available ? "Đang áp dụng" : "Hết lượt";
  const Icon = voucher.type === "PERCENT" ? Percent : Tag;

  async function copyCode() {
    if (!available) return;
    await navigator.clipboard.writeText(voucher.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (compact) {
    return (
      <div
        className={cn("flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm", className)}
        style={{ borderColor: hexToRgba(voucher.accent, 0.3) }}
      >
        <div
          className="flex items-center justify-between gap-1.5 border-b px-2.5 py-1.5"
          style={{ backgroundColor: hexToRgba(voucher.accent, 0.08), borderColor: hexToRgba(voucher.accent, 0.18) }}
        >
          <Icon size={12} style={{ color: voucher.accent }} />
          <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-semibold" style={{ color: voucher.accent }}>
            {remainingLabel}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-2.5">
          <p className="text-sm font-bold" style={{ color: voucher.accent }}>
            {voucher.type === "PERCENT" ? `Giảm ${voucher.value}%` : `Giảm ${voucher.value.toLocaleString("vi-VN")}đ`}
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-4 text-[#68574f]">{voucher.name}</p>
          <p className="mt-1 line-clamp-2 text-[10px] leading-3.5 text-[#826f66]">
            Đơn từ {formatMoney(voucher.minSpend)} · {voucher.constraint}
          </p>
          <p className="mt-1 truncate text-[10px] text-[#826f66]">HSD {voucher.expiresAt}</p>
          <button
            type="button"
            onClick={copyCode}
            disabled={!available}
            className="mt-2 inline-flex items-center justify-center gap-1 rounded-full px-2 py-1.5 text-[11px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: copied ? "#8a5a12" : voucher.accent }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {!available ? "Hết lượt" : copied ? "Đã chép" : voucher.code}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex shrink-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-lg shadow-black/15 ring-1 ring-white/20", className)}
      style={{ borderColor: hexToRgba(voucher.accent, 0.65) }}
    >
      <div
        className="flex items-center justify-between gap-2 border-b px-3.5 py-2"
        style={{ background: `linear-gradient(135deg, ${hexToRgba(voucher.accent, 0.22)}, ${hexToRgba(voucher.accent, 0.08)})`, borderColor: hexToRgba(voucher.accent, 0.35) }}
      >
        <div className="flex items-center gap-1.5" style={{ color: voucher.accent }}>
          <Icon size={13} />
          <p className="line-clamp-1 text-xs font-semibold uppercase tracking-[0.06em]">
            {voucher.type === "PERCENT" ? `Giảm ${voucher.value}%` : `Giảm ${voucher.value.toLocaleString("vi-VN")}đ`}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: "white", color: voucher.accent }}
        >
          {remainingLabel}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <p className="line-clamp-1 h-5 text-sm font-semibold leading-5 text-[#281b18]" title={voucher.name}>{voucher.name}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs leading-4 text-[#826f66]">
          <Clock size={12} className="shrink-0" />
          <span className="truncate">
            {voucher.constraint} · HSD {voucher.expiresAt}
          </span>
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="rounded-md bg-[#f7f2ee] px-2 py-1 text-xs font-bold tracking-wide text-[#281b18]">{voucher.code}</span>
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={copyCode}
              disabled={!available}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: copied ? "#8a5a12" : voucher.accent }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {!available ? "Hết lượt" : copied ? "Đã chép" : "Chép mã"}
            </button>
            {showAllLink ? (
              <Link
                href="/uu-dai"
                aria-label="Xem tất cả ưu đãi"
                title="Xem tất cả ưu đãi"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#c59a3d] bg-[#5c3a1e] text-[#e7c878] shadow-sm transition hover:translate-x-0.5"
              >
                <ArrowRight size={15} />
              </Link>
            ) : null}
          </span>
        </div>
      </div>
    </div>
  );
}
