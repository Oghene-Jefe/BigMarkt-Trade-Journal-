"use client";

import { useState, useTransition } from "react";
import { broadcastNotificationAction } from "../actions";

type Target = "all" | "specific";

export default function BroadcastForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [target, setTarget] = useState<Target>("all");
  const [targetUserId, setTargetUserId] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    const audience = target === "all" ? "all users" : "1 user";
    if (!window.confirm(`You are about to send to ${audience}. Are you sure?`)) {
      return;
    }
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("body", body.trim());
    fd.set("action_url", actionUrl.trim());
    if (target === "specific") fd.set("target_user_id", targetUserId.trim());
    startTransition(async () => {
      const res = await broadcastNotificationAction(null, fd);
      setResult(res);
      if (res.ok) {
        setTitle("");
        setBody("");
        setActionUrl("");
        setTargetUserId("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Title <span className="text-[10px]">({title.length}/100)</span>
        <input
          type="text"
          maxLength={100}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-md border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted">
        Body <span className="text-[10px]">({body.length}/500)</span>
        <textarea
          maxLength={500}
          rows={4}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="resize-y rounded-md border border-white/10 bg-bg px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
        />
      </label>

      <fieldset className="space-y-2 text-sm">
        <legend className="text-xs uppercase tracking-wider text-muted">Target</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="target"
            value="all"
            checked={target === "all"}
            onChange={() => setTarget("all")}
          />
          All users
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="target"
            value="specific"
            checked={target === "specific"}
            onChange={() => setTarget("specific")}
          />
          Specific user
        </label>
        {target === "specific" ? (
          <input
            type="text"
            placeholder="user uuid"
            required
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            className="rounded-md border border-white/10 bg-bg px-3 py-1.5 text-sm text-white"
          />
        ) : null}
      </fieldset>

      <label className="flex flex-col gap-1 text-xs text-muted">
        Action URL (optional)
        <input
          type="url"
          value={actionUrl}
          onChange={(e) => setActionUrl(e.target.value)}
          placeholder="https://..."
          className="rounded-md border border-white/10 bg-bg px-3 py-1.5 text-sm text-white"
        />
      </label>

      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted">Preview</p>
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: "rgba(212,175,55,0.3)",
            backgroundColor: "#141414",
            color: "#f5f5f5",
          }}
        >
          <p className="font-display text-base tracking-widest text-gold">
            {title.trim() || "Title goes here"}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
            {body.trim() || "Body goes here."}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span
          className={`text-xs ${result?.ok ? "text-win" : result ? "text-loss" : "text-muted"}`}
        >
          {result?.message ?? ""}
        </span>
        <button
          type="submit"
          disabled={pending || !title.trim() || !body.trim()}
          className="rounded-md bg-gold px-5 py-2 font-display text-sm tracking-widest text-black disabled:opacity-50"
        >
          {pending ? "SENDING…" : "SEND BROADCAST"}
        </button>
      </div>
    </form>
  );
}
