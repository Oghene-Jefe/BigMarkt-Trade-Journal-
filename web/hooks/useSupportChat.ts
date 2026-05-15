"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { SupportConversation, SupportMessage } from "@/lib/types";

// Realtime is gated by `isOpen` — the channel is only subscribed while the
// widget is open. Closing the widget tears the channel down. This keeps us
// well within Supabase's free-tier concurrent-connection budget when most
// users have the chat collapsed.
export function useSupportChat(userId: string, isOpen: boolean) {
  const supabase = useRef(supabaseBrowser()).current;
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // EFFECT 1 — load or create the active conversation, then its messages.
  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const { data: existing } = await supabase
          .from("support_conversations")
          .select("*")
          .eq("user_id", userId)
          .neq("status", "closed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let convo = existing as SupportConversation | null;
        if (!convo) {
          const { data: created, error } = await supabase
            .from("support_conversations")
            .insert({ user_id: userId, status: "open" })
            .select()
            .single();
          if (error) throw error;
          convo = created as SupportConversation;
        }
        if (cancelled) return;
        setConversation(convo);

        const { data: msgs } = await supabase
          .from("support_messages")
          .select("*")
          .eq("conversation_id", convo.id)
          .order("created_at", { ascending: true });

        if (cancelled) return;
        const list = (msgs ?? []) as SupportMessage[];
        setMessages(list);
        setUnreadCount(
          list.filter((m) => m.sender_role === "admin" && m.read_at == null).length,
        );
      } catch (e) {
        console.error("useSupportChat init failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, supabase]);

  // EFFECT 2 — CONNECTION GUARD. Only subscribe while the widget is open.
  useEffect(() => {
    if (!isOpen || !conversation) return;
    const channel = supabase
      .channel(`support_messages_${conversation.id}`)
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
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (newMsg.sender_role === "admin") {
            setUnreadCount((c) => c + 1);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, conversation, supabase]);

  // EFFECT 3 — mark admin messages read when the widget opens.
  useEffect(() => {
    if (!isOpen || !conversation) return;
    (async () => {
      const nowIso = new Date().toISOString();
      await Promise.all([
        supabase
          .from("support_conversations")
          .update({ unread_by_user: false })
          .eq("id", conversation.id),
        supabase
          .from("support_messages")
          .update({ read_at: nowIso })
          .eq("conversation_id", conversation.id)
          .eq("sender_role", "admin")
          .is("read_at", null),
      ]);
      setUnreadCount(0);
    })();
  }, [isOpen, conversation, supabase]);

  const sendMessage = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed || !conversation) return;
      setSending(true);
      const optimisticId = `optimistic-${Date.now()}`;
      const optimistic: SupportMessage = {
        id: optimisticId,
        conversation_id: conversation.id,
        sender_id: userId,
        sender_role: "user",
        body: trimmed,
        created_at: new Date().toISOString(),
        read_at: null,
      };
      setMessages((prev) => [...prev, optimistic]);
      try {
        const { data, error } = await supabase
          .from("support_messages")
          .insert({
            conversation_id: conversation.id,
            sender_id: userId,
            sender_role: "user",
            body: trimmed,
          })
          .select()
          .single();
        if (error) throw error;
        const saved = data as SupportMessage;
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? saved : m)),
        );
      } catch (e) {
        console.error("sendMessage failed", e);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      } finally {
        setSending(false);
      }
    },
    [conversation, supabase, userId],
  );

  return { conversation, messages, loading, sending, sendMessage, unreadCount };
}
