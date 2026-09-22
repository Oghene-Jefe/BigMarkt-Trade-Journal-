import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { requireSupportAgent } from "@/lib/support-agent";
import type { SupportConversation, SupportMessage } from "@/lib/types";
import AgentConversationView from "./AgentConversationView";

export const dynamic = "force-dynamic";

type Person = {
  user_id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  member_since: string | null;
};

export default async function SupportDeskConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const agentId = await requireSupportAgent();
  const { id } = await params;
  const sb = await supabaseServer();

  const { data: conversation } = await sb
    .from("support_conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!conversation) notFound();

  const [{ data: messages }, { data: people }] = await Promise.all([
    sb
      .from("support_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
    sb.rpc("support_people", { p_conversation_ids: [id] }),
  ]);

  const person = ((people ?? []) as Person[])[0] ?? null;

  return (
    <AgentConversationView
      conversation={conversation as SupportConversation}
      initialMessages={(messages ?? []) as SupportMessage[]}
      person={{
        email: person?.email ?? null,
        username: person?.username ?? null,
        display_name: person?.display_name ?? null,
        member_since: person?.member_since ?? null,
      }}
      agentId={agentId}
    />
  );
}
