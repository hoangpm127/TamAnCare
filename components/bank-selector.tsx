"use client";

import { cn } from "@/lib/utils";

export const BANKS = [
  { code: "VCB", name: "Vietcombank", color: "#76551d" },
  { code: "TCB", name: "Techcombank", color: "#e30613" },
  { code: "MBB", name: "MB Bank", color: "#1d3557" },
  { code: "ACB", name: "ACB", color: "#0033a0" },
  { code: "BIDV", name: "BIDV", color: "#00558c" },
  { code: "CTG", name: "VietinBank", color: "#0a3b7c" },
  { code: "VPB", name: "VPBank", color: "#a85f29" },
  { code: "TPB", name: "TPBank", color: "#7b2d8e" },
  { code: "STB", name: "Sacombank", color: "#0b4ea2" },
];

export function BankSelector({ selected, onSelect }: { selected: string | null; onSelect: (code: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {BANKS.map((bank) => (
        <button
          key={bank.code}
          type="button"
          onClick={() => onSelect(bank.code)}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition",
            selected === bank.code ? "border-[#c64b32] bg-[#f8ebe5]" : "border-[#e7d6ca] bg-white hover:border-[#c7a296]"
          )}
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ backgroundColor: bank.color }}
          >
            {bank.code}
          </span>
          <span className="line-clamp-1 text-[10px] font-medium text-[#51423b]">{bank.name}</span>
        </button>
      ))}
    </div>
  );
}
