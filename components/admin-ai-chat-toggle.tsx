"use client";

import { useSyncExternalStore } from "react";
import { MessageCircle } from "lucide-react";
import { chatAssistant } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  const stored = window.localStorage.getItem(chatAssistant.storageKey);
  return stored === null ? chatAssistant.enabledByDefault : stored === "true";
}

function getServerSnapshot() {
  return chatAssistant.enabledByDefault;
}

function setEnabled(next: boolean) {
  window.localStorage.setItem(chatAssistant.storageKey, String(next));
  listeners.forEach((listener) => listener());
}

export function AdminAiChatToggle() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div className="mb-4 flex items-start justify-between gap-4 rounded-lg border border-[#e7d6ca] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f8ebe5] text-[#c64b32]">
          <MessageCircle size={18} />
        </span>
        <div>
          <p className="text-sm font-semibold">{chatAssistant.label}</p>
          <p className="mt-1 max-w-md text-xs leading-5 text-[#68574f]">{chatAssistant.description}</p>
          <p className="mt-1 text-[11px] text-[#826f66]">Quyền bật/tắt: Super Admin, Quản lý cơ sở.</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => setEnabled(!enabled)}
        className={cn("relative h-7 w-12 shrink-0 rounded-full transition", enabled ? "bg-[#18815e]" : "bg-[#d8cdc6]")}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
            enabled ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}
