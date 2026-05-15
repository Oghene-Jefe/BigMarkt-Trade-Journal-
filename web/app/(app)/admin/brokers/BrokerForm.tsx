"use client";

import { useState } from "react";
import { createBrokerAction, updateBrokerAction } from "../actions";

interface Props {
  initial?: {
    id?: string;
    name?: string;
    website_url?: string | null;
    logo_url?: string | null;
    description?: string | null;
    is_recommended?: boolean;
    sort_order?: number;
  };
  onDone?: () => void;
}

export default function BrokerForm({ initial, onDone }: Props) {
  const editing = !!initial?.id;
  const [pending, setPending] = useState(false);
  const action = editing ? updateBrokerAction : createBrokerAction;

  return (
    <form
      action={async (fd) => {
        setPending(true);
        try {
          await action(fd);
          onDone?.();
        } finally {
          setPending(false);
        }
      }}
      className="grid grid-cols-1 gap-3 rounded-lg border border-white/10 bg-panel p-4 md:grid-cols-2"
    >
      {editing ? <input type="hidden" name="id" value={initial!.id} /> : null}

      <label className="flex flex-col gap-1 text-xs text-muted md:col-span-2">
        Name
        <input
          type="text"
          name="name"
          required
          defaultValue={initial?.name ?? ""}
          className="rounded-md border border-white/10 bg-bg px-3 py-1.5 text-sm text-white outline-none focus:border-gold/40"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted">
        Website URL
        <input
          type="url"
          name="website_url"
          defaultValue={initial?.website_url ?? ""}
          className="rounded-md border border-white/10 bg-bg px-3 py-1.5 text-sm text-white"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted">
        Logo URL
        <input
          type="url"
          name="logo_url"
          defaultValue={initial?.logo_url ?? ""}
          className="rounded-md border border-white/10 bg-bg px-3 py-1.5 text-sm text-white"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted md:col-span-2">
        Description
        <textarea
          name="description"
          rows={3}
          defaultValue={initial?.description ?? ""}
          className="resize-y rounded-md border border-white/10 bg-bg px-3 py-1.5 text-sm text-white"
        />
      </label>

      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          name="is_recommended"
          defaultChecked={!!initial?.is_recommended}
        />
        Recommended
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted">
        Sort Order
        <input
          type="number"
          name="sort_order"
          defaultValue={initial?.sort_order ?? 0}
          className="rounded-md border border-white/10 bg-bg px-3 py-1.5 text-sm text-white"
        />
      </label>

      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-gold px-4 py-1.5 text-xs font-medium text-black disabled:opacity-50"
        >
          {pending ? "SAVING…" : editing ? "UPDATE BROKER" : "ADD BROKER"}
        </button>
      </div>
    </form>
  );
}
