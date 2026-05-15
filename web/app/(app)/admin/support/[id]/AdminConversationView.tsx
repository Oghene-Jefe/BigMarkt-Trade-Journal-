"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { SupportConversation, SupportMessage } from "@/lib/types";
import { Loader2 } from "lucide-react";

interface Props {
  conversation: SupportConversation;
  initialMessages: SupportMessage[];
  userProfile: {
    email: string | null;
    username: string | null;
    display_name: string | null;
    created_at: string | null;
  };
  adminId: string;
}

const GOLD = "#D4AF37";
const ADMIN_BUBBLE = "#1a1a1a";
const TEXT_MUTED = "#6b7280";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

export default function AdminConversationView({
  conversation,
  initialMessages,
  userProfile,
  adminId,
}: Props) {
  const supabase = useRef(supabaseBrowser()).current;
  const [messages, setMessages] = useState<SupportMessage[]>(initialMessages);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<SupportConversation["status"]>(
    conversation.status,
  );
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Admin view subscribes to realtime unconditionally — this is the
  // active operator workstation, not a passive widget. Tradeoff documented.
  useEffect(() => {
    const channel = supabase
      .channel(`admin_support_messages_${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as SupportMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg],
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, supabase]);

  // Mark inbox unread flag clear when admin opens the conversation.
  useEffect(() => {
    void supabase
      .from("support_conversations")
      .update({ unread_by_admin: false })
      .eq("id", conversation.id);
  }, [conversation.id, supabase]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleStatusChange(next: SupportConversation["status"]) {
    setStatus(next);
    const { error: e } = await supabase
      .from("support_conversations")
      .update({ status: next })
      .eq("id", conversation.id);
    if (e) {
      console.error("status update failed", e);
      setError("Failed to update status");
    }
  }

  async function handleSend() {
    const body = reply.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: SupportMessage = {
      id: optimisticId,
      conversation_id: conversation.id,
      sender_id: adminId,
      sender_role: "admin",
      body,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setReply("");
    try {
      const { data, error: insertErr } = await supabase
        .from("support_messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: adminId,
          sender_role: "admin",
          body,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;
      const saved = data as SupportMessage;
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? saved : m)),
      );
      await supabase
        .from("support_conversations")
        .update({ unread_by_user: true, unread_by_admin: false })
        .eq("id", conversation.id);
    } catch (e) {
      console.error("admin reply failed", e);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError(e instanceof Error ? e.message : "Reply failed");
    } finally {
      setSending(false);
    }
  }

  const display =
    userProfile.username ||
    userProfile.display_name ||
    userProfile.email?.split("@")[0] ||
    "Trader";

  return (
    <div className="space-y-4">
      <Link
        href={"/admin/support" as Route}
        className="inline-block text-sm text-muted hover:text-gold"
      >
        ← Support Inbox
      </Link>

      <div className="rounded-lg border border-white/10 bg-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">
              {display}
            </p>
            {userProfile.email ? (
              <p className="text-xs text-muted">{userProfile.email}</p>
            ) : null}
            {userProfile.created_at ? (
              <p className="text-xs text-muted">
                Member since{" "}
                {new Date(userProfile.created_at).toLocaleDateString()}
              </p>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            Status
            <select
              value={status}
              onChange={(e) =>
                handleStatusChange(e.target.value as SupportConversation["status"])
              }
              className="rounded-md border border-white/10 bg-bg px-2 py-1 text-sm text-white"
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </label>
        </div>
      </div>

      <div
        className="flex flex-col gap-3 overflow-y-auto rounded-lg border border-white/10 bg-panel p-4"
        style={{ minHeight: 360, maxHeight: 560 }}
      >
        {messages.length === 0 ? (
          <p className="my-auto text-center text-sm text-muted">
            No messages yet.
          </p>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} />)
        )}
        <div ref={endRef} />
      </div>

      <div className="rounded-lg border border-white/10 bg-panel p-3">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={3}
          placeholder="Type your reply..."
          className="w-full resize-y rounded-md border border-white/10 bg-bg p-2 text-sm text-white outline-none focus:border-gold/40"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-loss">{error ?? ""}</span>
          <button
            type="button"
            onClick={handleSend}
            disabled={!reply.trim() || sending}
            className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            SEND REPLY
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: SupportMessage }) {
  const isAdmin = m.sender_role === "admin";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isAdmin ? "flex-end" : "flex-start",
        maxWidth: "80%",
        alignSelf: isAdmin ? "flex-end" : "flex-start",
      }}
    >
      <span
        style={{
          color: TEXT_MUTED,
          fontSize: 10,
          marginBottom: 2,
        }}
      >
        {isAdmin ? "You (Admin)" : "User"}
      </span>
      <div
        style={{
          backgroundColor: isAdmin ? GOLD : ADMIN_BUBBLE,
          color: isAdmin ? "#000000" : "#ffffff",
          padding: "10px 14px",
          borderRadius: 12,
          borderBottomRightRadius: isAdmin ? 4 : 12,
          borderBottomLeftRadius: isAdmin ? 12 : 4,
          fontSize: 14,
          lineHeight: 1.5,
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}
      >
        {m.body}
      </div>
      <span style={{ color: TEXT_MUTED, fontSize: 10, marginTop: 2 }}>
        {fmtTime(m.created_at)}
      </span>
    </div>
  );
}
