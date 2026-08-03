"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type CompactSelectOption = {
  value: string;
  label: string;
  description?: string;
};

type PopoverPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

export function CompactSelect({
  value,
  options,
  onValueChange,
  disabled = false,
  placeholder = "Chọn một mục",
  dialogTitle = "Lựa chọn",
  className,
  triggerClassName,
  dark = false,
  icon,
}: {
  value: string;
  options: readonly CompactSelectOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  dialogTitle?: string;
  className?: string;
  triggerClassName?: string;
  dark?: boolean;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = useMemo(() => options.find((option) => option.value === value), [options, value]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(viewportWidth - 16, Math.max(rect.width, Math.min(300, viewportWidth - 16)));
    const left = Math.min(Math.max(8, rect.left), viewportWidth - width - 8);
    const estimatedHeight = Math.min(360, 58 + Math.min(options.length, 6) * 48 + 16);
    const spaceBelow = viewportHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const placeBelow = spaceBelow >= Math.min(estimatedHeight, 220) || spaceBelow >= spaceAbove;
    const availableHeight = Math.max(150, (placeBelow ? spaceBelow : spaceAbove) - 6);
    const maxHeight = Math.min(estimatedHeight, availableHeight);
    const top = placeBelow ? rect.bottom + 6 : Math.max(8, rect.top - maxHeight - 6);
    setPosition({ left, top, width, maxHeight });
  }, [options.length]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onViewportChange = () => updatePosition();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open, updatePosition]);

  return (
    <div className={cn("min-w-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          updatePosition();
          setOpen(true);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex min-h-10 w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold outline-none transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60",
          dark
            ? "border-white/15 bg-white/10 text-white hover:bg-white/15"
            : "border-[#eadbd1] bg-white text-[#2d211d] shadow-[0_1px_4px_rgba(92,58,30,0.04)] hover:border-[#d8b46a]",
          triggerClassName,
        )}
      >
        {icon ? <span className={cn("shrink-0", dark ? "text-[#f5d982]" : "text-[#d13f1f]")}>{icon}</span> : null}
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown size={15} className={cn("shrink-0 transition", open && "rotate-180", dark ? "text-white/65" : "text-[#8a7a72]")} />
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[160]">
              <button type="button" className="absolute inset-0 bg-[#160d0a]/[0.04]" onClick={() => setOpen(false)} aria-label="Đóng bảng lựa chọn" />
              <section
                className="fixed overflow-hidden rounded-2xl border border-[#d8b46a]/70 bg-[#fffdfb] shadow-[0_16px_42px_rgba(41,20,13,0.28)]"
                style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight }}
              >
                <header className="flex items-center gap-2 border-b border-[#eadbd1] bg-gradient-to-r from-[#2f1b16] via-[#4a281e] to-[#762b27] px-3 py-2.5 text-white">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#f5d982] ring-1 ring-white/15">
                    <SlidersHorizontal size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-[#f5d982]">Tâm An Care</p>
                    <h2 className="truncate text-[12px] font-semibold leading-4">{dialogTitle}</h2>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15" aria-label="Đóng">
                    <X size={14} />
                  </button>
                </header>

                <div className="overflow-y-auto p-1.5" style={{ maxHeight: Math.max(96, position.maxHeight - 49) }}>
                  <div className="grid gap-1" role="listbox" aria-label={dialogTitle}>
                    {options.map((option) => {
                      const active = option.value === value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            onValueChange(option.value);
                            setOpen(false);
                          }}
                          className={cn(
                            "flex min-h-10 min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition",
                            active
                              ? "border-[#d13f1f] bg-gradient-to-br from-[#fff2ef] to-[#fff8e8] text-[#8f171b] shadow-sm"
                              : "border-[#eee3dc] bg-white text-[#33251f] hover:border-[#d8b46a] hover:bg-[#fffaf6]",
                          )}
                        >
                          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", active ? "border-[#d13f1f] bg-[#d13f1f] text-white" : "border-[#e3d5cc] bg-[#fbf6f2] text-transparent")}>
                            <Check size={12} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12px] font-semibold leading-4">{option.label}</span>
                            {option.description ? <span className="mt-0.5 block text-[9px] leading-3.5 text-[#8a7a72]">{option.description}</span> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
