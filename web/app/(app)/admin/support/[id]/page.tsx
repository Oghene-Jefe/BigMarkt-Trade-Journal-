import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { SupportConversation, SupportMessage } from "@/lib/types";
import AdminConversationView from "./AdminConversationView";

export const dynamic = "force-dynamic";

export default async function AdminConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sb = await supabaseServer();

  const { data: convo } = await sb
    .from("support_conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!convo) notFound();
  const conversation = convo as SupportConversation;

  const { data: msgs } = await sb
    .from("support_messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const { data: profile } = await sb
    .from("profiles")
    .select("email, username, display_name, created_at")
    .eq("id", conversation.user_id)
    .maybeSingle();

  const { data: { user: me } } = await sb.auth.getUser();

  return (
    <AdminConversationView
      conversation={conversation}
      initialMessages={(msgs ?? []) as SupportMessage[]}
      userProfile={{
        email: (profile?.email ?? null) as string | null,
        username: (profile?.username ?? null) as string | null,
        display_name: (profile?.display_name ?? null) as string | null,
        created_at: (profile?.created_at ?? null) as string | null,
      }}
      adminId={me?.id ?? ""}
    />
  );
}
