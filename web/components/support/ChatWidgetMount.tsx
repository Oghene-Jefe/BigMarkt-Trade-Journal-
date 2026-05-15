"use client";

// Thin client wrapper so the (server) app layout can opt the chat widget
// out of SSR. Next 15 forbids `ssr: false` in `next/dynamic` from a server
// component, so the dynamic import has to live behind a "use client" file.
import dynamic from "next/dynamic";

const ChatWidget = dynamic(() => import("./ChatWidget"), { ssr: false });

export default function ChatWidgetMount({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  return <ChatWidget userId={userId} username={username} />;
}
