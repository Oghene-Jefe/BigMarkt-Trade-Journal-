"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, ChevronDown, Send, Loader2 } from "lucide-react";
import { useSupportChat } from "@/hooks/useSupportChat";
import type { SupportMessage } from "@/lib/types";

interface ChatWidgetProps {
  userId: string;
  username: string;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatWidget({ userId, username }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const { messages, loading, sending, sendMessage, unreadCount } =
    useSupportChat(userId, isOpen);

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isOpen) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  function handleSend() {
    const v = inputValue.trim();
    if (!v || sending) return;
    setInputValue("");
    void sendMessage(v);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open support chat"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gold shadow-xl shadow-black/40 transition hover:bg-gold/90"
      >
        <MessageCircle size={24} className="text-black" aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[480px] w-[min(320px,calc(100vw-24px))] flex-col overflow-hidden rounded-lg border border-gold/40 bg-bg shadow-xl shadow-black/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gold/20 bg-panel p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gold">Support</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
          <span className="text-[11px] text-muted">Online</span>
        </div>
        <button
          type="button"
          aria-label="Minimize chat"
          onClick={() => setIsOpen(false)}
          className="p-1 text-muted hover:text-white"
        >
          <ChevronDown size={18} aria-hidden />
        </button>
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {loading ? (
          <Skeleton />
        ) : messages.length === 0 ? (
          <div className="mt-6 text-center">
            <p className="mb-2 text-base text-gold">Hi {username}.</p>
            <p className="text-xs leading-relaxed text-muted">
              Send us a message and we&apos;ll get back to you shortly.
            </p>
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} />)
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-gold/20 bg-panel p-3">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && inputValue.trim()) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message..."
          className="flex-1 bg-transparent text-sm text-white outline-none"
        />
        <button
          type="button"
          aria-label="Send message"
          onClick={handleSend}
          disabled={!inputValue.trim() || sending}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gold transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:bg-gray-600"
        >
          {sending ? (
            <Loader2 size={14} aria-hidden className="animate-spin text-gray-300" />
          ) : (
            <Send
              size={14}
              aria-hidden
              className={!inputValue.trim() ? "text-gray-400" : "text-black"}
            />
          )}
        </button>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: SupportMessage }) {
  const isUser = m.sender_role === "user";
  return (
    <div
      className={`flex max-w-[85%] flex-col ${
        isUser ? "items-end self-end" : "items-start self-start"
      }`}
    >
      {!isUser ? (
        <span className="mb-0.5 text-[10px] text-muted">Support</span>
      ) : null}
      <div
        className={`whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-[13px] leading-snug ${
          isUser
            ? "bg-gold text-black"
            : "bg-[#1a1a1a] text-white"
        } ${isUser ? "rounded-br-sm" : "rounded-bl-sm"}`}
      >
        {m.body}
      </div>
      <span
        className={`mt-0.5 text-[10px] text-muted ${
          isUser ? "self-end" : "self-start"
        }`}
      >
        {fmtTime(m.created_at)}
      </span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`h-8 animate-pulse rounded-lg bg-[#1a1a1a] opacity-60 ${
            i % 2 === 0 ? "w-[55%] self-start" : "w-[70%] self-end"
          }`}
        />
      ))}
    </div>
  );
}
