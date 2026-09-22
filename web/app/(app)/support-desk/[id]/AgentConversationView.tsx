"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { SupportConversation, SupportMessage } from "@/lib/types";
import { Loader2 } from "lucide-react";

// Agent-facing thread view. Same behaviour as AdminConversationView, but the
// only trader details shown are the ones support_people returns (name, email,
// join date) — an agent has no route to trades, balances or admin pages.

interface Props {
  conversation: SupportConversation;
  initialMessages: SupportMessage[];
  person: {
    email: string | null;
    username: string | null;
    display_name: string | null;
    member_since: string | null;
  };
  agentId: string;
}

const GOLD = "#D4AF37";
const TRADER_BUBBLE = "#1a1a1a";
const TEXT_MUTED = "#6b7280";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

export default function AgentConversationView({
  conversation,
  initialMessages,
  person,
  agentId,
}: Props) {
  const supabase = useRef(supabaseBrowser()).current;
  const [messages, setMessages] = useState<SupportMessage[]>(initialMessages);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<SupportConversation["status"]>(conversation.status);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // The desk is an operator workstation, so realtime stays subscribed.
  useEffect(() => {
    const channel = supabase
      .channel(`support_desk_messages_${conversation.id}`)
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
          setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, supabase]);

  // Opening the thread clears the inbox's "waiting on us" dot.
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
    if (e) setError("Couldn't update the status.");
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
      sender_id: agentId,
      sender_role: "admin",
      body,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setReply("");
    try {
      // sender_role stays 'admin': that's the support side of the thread, and
      // the trader's app labels it "BigMarkt support".
      const { data, error: insertErr } = await supabase
        .from("support_messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: agentId,
          sender_role: "admin",
          body,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;
      setMessages((prev) => prev.map((m) => (m.id === optimisticId ? (data as SupportMessage) : m)));
      await supabase
        .from("support_conversations")
        .update({ unread_by_user: true, unread_by_admin: false })
        .eq("id", conversation.id);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError("Reply failed. Try again.");
    } finally {
      setSending(false);
    }
  }

  const display =
    person.username || person.display_name || person.email?.split("@")[0] || "Trader";

  return (
    <div className="space-y-4">
      <Link href={"/support-desk" as Route} className="inline-block text-sm text-muted hover:text-gold">
        ← Support desk
      </Link>

      <div className="rounded-lg border border-white/10 bg-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{display}</p>
            {person.email ? <p className="text-xs text-muted">{person.email}</p> : null}
            {person.member_since ? (
              <p className="text-xs text-muted">
                Member since {new Date(person.member_since).toLocaleDateString()}
              </p>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            Status
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as SupportConversation["status"])}
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
          <p className="my-auto text-center text-sm text-muted">No messages yet.</p>
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
  const fromSupport = m.sender_role === "admin";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: fromSupport ? "flex-end" : "flex-start",
        maxWidth: "80%",
        alignSelf: fromSupport ? "flex-end" : "flex-start",
      }}
    >
      <span style={{ color: TEXT_MUTED, fontSize: 10, marginBottom: 2 }}>
        {fromSupport ? "Support" : "Trader"}
      </span>
      <div
        style={{
          backgroundColor: fromSupport ? GOLD : TRADER_BUBBLE,
          color: fromSupport ? "#000000" : "#ffffff",
          padding: "10px 14px",
          borderRadius: 12,
          borderBottomRightRadius: fromSupport ? 4 : 12,
          borderBottomLeftRadius: fromSupport ? 12 : 4,
          fontSize: 14,
          lineHeight: 1.5,
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}
      >
        {m.body}
      </div>
      <span style={{ color: TEXT_MUTED, fontSize: 10, marginTop: 2 }}>{fmtTime(m.created_at)}</span>
    </div>
  );
}
