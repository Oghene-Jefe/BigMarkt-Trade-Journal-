"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, ChevronDown, Send, Loader2 } from "lucide-react";
import { useSupportChat } from "@/hooks/useSupportChat";
import type { SupportMessage } from "@/lib/types";

interface ChatWidgetProps {
  userId: string;
  username: string;
}

const GOLD = "#D4AF37";
const GOLD_BORDER = "rgba(212,175,55,0.4)";
const GOLD_DIV = "rgba(212,175,55,0.2)";
const BG = "#0a0a0a";
const HEADER_BG = "#141414";
const ADMIN_BUBBLE = "#1a1a1a";
const TEXT_MUTED = "#6b7280";

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
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 50,
          width: 56,
          height: 56,
          borderRadius: 9999,
          backgroundColor: GOLD,
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 10px 25px rgba(0,0,0,0.45)",
        }}
      >
        <MessageCircle size={24} color="#000000" />
        {unreadCount > 0 ? (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 20,
              height: 20,
              padding: "0 5px",
              borderRadius: 9999,
              backgroundColor: "#ef4444",
              color: "#ffffff",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 50,
        width: "min(320px, calc(100vw - 24px))",
        height: 480,
        backgroundColor: BG,
        border: `1px solid ${GOLD_BORDER}`,
        borderRadius: 12,
        boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: HEADER_BG,
          borderBottom: `1px solid ${GOLD_DIV}`,
          padding: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: GOLD, fontWeight: 700, fontSize: 14 }}>Support</span>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 9999,
              backgroundColor: "#22c55e",
            }}
          />
          <span style={{ color: TEXT_MUTED, fontSize: 11 }}>Online</span>
        </div>
        <button
          type="button"
          aria-label="Minimize chat"
          onClick={() => setIsOpen(false)}
          style={{
            background: "transparent",
            border: "none",
            color: TEXT_MUTED,
            cursor: "pointer",
            padding: 4,
          }}
        >
          <ChevronDown size={18} />
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {loading ? (
          <Skeleton />
        ) : messages.length === 0 ? (
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <p style={{ color: GOLD, fontSize: 16, marginBottom: 8 }}>
              👋 Hi {username}!
            </p>
            <p style={{ color: TEXT_MUTED, fontSize: 12, lineHeight: 1.5 }}>
              Send us a message and we&apos;ll get back to you shortly.
            </p>
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} />)
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div
        style={{
          backgroundColor: HEADER_BG,
          borderTop: `1px solid ${GOLD_DIV}`,
          padding: 12,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
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
          style={{
            flex: 1,
            backgroundColor: "transparent",
            color: "#ffffff",
            border: "none",
            outline: "none",
            fontSize: 14,
          }}
        />
        <button
          type="button"
          aria-label="Send message"
          onClick={handleSend}
          disabled={!inputValue.trim() || sending}
          style={{
            width: 36,
            height: 36,
            borderRadius: 9999,
            backgroundColor: !inputValue.trim() || sending ? "#374151" : GOLD,
            border: "none",
            cursor: !inputValue.trim() || sending ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {sending ? (
            <Loader2 size={14} color="#a3a3a3" className="animate-spin" />
          ) : (
            <Send size={14} color={!inputValue.trim() ? "#9ca3af" : "#000000"} />
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
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        maxWidth: "85%",
        alignSelf: isUser ? "flex-end" : "flex-start",
      }}
    >
      {!isUser ? (
        <span style={{ color: TEXT_MUTED, fontSize: 10, marginBottom: 2 }}>
          Support
        </span>
      ) : null}
      <div
        style={{
          backgroundColor: isUser ? GOLD : ADMIN_BUBBLE,
          color: isUser ? "#000000" : "#ffffff",
          padding: "8px 12px",
          borderRadius: 12,
          borderBottomRightRadius: isUser ? 4 : 12,
          borderBottomLeftRadius: isUser ? 12 : 4,
          fontSize: 13,
          lineHeight: 1.45,
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}
      >
        {m.body}
      </div>
      <span
        style={{
          color: TEXT_MUTED,
          fontSize: 10,
          marginTop: 2,
          alignSelf: isUser ? "flex-end" : "flex-start",
        }}
      >
        {fmtTime(m.created_at)}
      </span>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            height: 32,
            width: i % 2 === 0 ? "55%" : "70%",
            alignSelf: i % 2 === 0 ? "flex-start" : "flex-end",
            backgroundColor: "#1a1a1a",
            borderRadius: 12,
            opacity: 0.6,
          }}
          className="animate-pulse"
        />
      ))}
    </div>
  );
}
