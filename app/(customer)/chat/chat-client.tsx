"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Phone, Send } from "lucide-react";
import type { CatalogBranch } from "@/lib/catalog-types";
import { classifyAndReply } from "@/lib/chat-assistant";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  from: "customer" | "branch";
  text: string;
  time: Date;
};

const QUICK_REPLIES = ["Giá bao nhiêu?", "Địa chỉ ở đâu?", "Hôm nay còn lịch không?", "Để em xem đã"];
function createInitialMessages(branchLabel: string): Message[] {
  return [
    {
      id: "m1",
      from: "branch",
      text: `Xin chào! Mình là trợ lý tự động của ${branchLabel}. Nội dung chỉ mang tính hướng dẫn và không được chuyển trực tiếp cho lễ tân.`,
      time: new Date(Date.now() - 1000 * 60 * 20),
    },
  ];
}

export function ChatClient({ branches }: { branches: CatalogBranch[] }) {
  const router = useRouter();
  const primaryBranch = branches[0];
  const branchLabel = primaryBranch ? `Tâm An Care · ${primaryBranch.label}` : "Tâm An Care";
  const [messages, setMessages] = useState<Message[]>(() => createInitialMessages(branchLabel));
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [assistantEnabled, setAssistantEnabled] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    fetch("/api/chat-settings", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { enabled: true })
      .then((data) => setAssistantEnabled(data.enabled !== false))
      .catch(() => setAssistantEnabled(true));
  }, []);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const customerMessage: Message = { id: crypto.randomUUID(), from: "customer", text: trimmed, time: new Date() };
    setMessages((prev) => [...prev, customerMessage]);
    setDraft("");

    if (!assistantEnabled) {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), from: "branch", text: "Trợ lý tự động đang tạm dừng. Vui lòng dùng nút gọi hotline hoặc mở mục Liên hệ để gặp lễ tân.", time: new Date() },
        ]);
      }, 900);
      return;
    }

    setTyping(true);
    setTimeout(() => {
      const { reply } = classifyAndReply(trimmed, branches);
      setTyping(false);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), from: "branch", text: reply, time: new Date() }]);
    }, 900);
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[#fffaf6] text-[#191414]">
      <header className="flex items-center gap-3 border-b border-[#eadbd1] bg-white/95 px-4 py-3 backdrop-blur">
        <button type="button" onClick={() => router.back()} className="text-[#4d403a]" aria-label="Quay lại">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{branchLabel}</p>
          <p className="text-xs text-[#8a7a72]">Trợ lý tự động · không phải chat trực tiếp</p>
        </div>
        {primaryBranch?.phone ? <a
          href={`tel:${primaryBranch.phone.replace(/\s/g, "")}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#fff2ef] text-[#9f1d20]"
          aria-label="Gọi hotline"
        >
          <Phone size={16} />
        </a> : null}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((message) => (
          <div key={message.id} className={cn("flex", message.from === "customer" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-6",
                message.from === "customer" ? "bg-[#9f1d20] text-white" : "border border-[#eadbd1] bg-white text-[#191414]"
              )}
            >
              <p>{message.text}</p>
              <p
                className={cn("mt-1 text-[10px]", message.from === "customer" ? "text-white/70" : "text-[#8a7a72]")}
                suppressHydrationWarning
              >
                {format(message.time, "HH:mm")}
              </p>
            </div>
          </div>
        ))}
        {typing ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl border border-[#eadbd1] bg-white px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#c9a59a] [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#c9a59a] [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#c9a59a]" />
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[#eadbd1] bg-white/95 px-4 pb-[env(safe-area-inset-bottom)] pt-3">
        <div className="scrollbar-hide -mx-1 mb-2 flex gap-2 overflow-x-auto px-1">
          {QUICK_REPLIES.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => send(reply)}
              className="shrink-0 rounded-full border border-[#eadbd1] px-3 py-1.5 text-xs font-medium text-[#4d403a] hover:border-[#c9a59a]"
            >
              {reply}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
          className="flex items-center gap-2 pb-3"
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Nhập tin nhắn..."
            className="flex-1 rounded-full border border-[#eadbd1] px-4 py-3 text-sm"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#9f1d20] text-white disabled:opacity-50"
            aria-label="Gửi"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
