"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  BROKERS,
  STATUS_META,
  type BrokerCategory,
  type BrokerStatus,
} from "@/lib/brokers";
import UnlistedBrokerChecker from "@/components/brokers/UnlistedBrokerChecker";
import BrokerSubmissionForm from "@/components/brokers/BrokerSubmissionForm";

const ALL_CATEGORIES: (BrokerCategory | "all")[] = [
  "all",
  "forex",
  "crypto",
  "futures",
  "stocks",
  "prop_firm",
];
const ALL_STATUSES: (BrokerStatus | "all")[] = [
  "all",
  "supported",
  "partial",
  "unsupported",
  "inactive",
];

export default function BrokersPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<BrokerCategory | "all">("all");
  const [status, setStatus] = useState<BrokerStatus | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BROKERS.filter((b) => {
      if (category !== "all" && !b.categories.includes(category)) return false;
      if (status !== "all" && b.status !== status) return false;
      if (q) {
        const hay = (b.name + " " + b.platform.join(" ")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [query, category, status]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="font-display text-3xl tracking-widest text-gold">
          BROKER COMPATIBILITY
        </h1>
        <p className="mt-1 text-sm text-muted">
          Find out whether your broker plugs into BigMarkt's automated journal.
        </p>
      </header>

      <section className="flex flex-wrap gap-3">
        {(["supported", "partial", "unsupported", "inactive"] as BrokerStatus[]).map((s) => {
          const meta = STATUS_META[s];
          return (
            <span
              key={s}
              className={`rounded-full border px-3 py-1 text-xs ${meta.bg} ${meta.color}`}
            >
              {meta.dot} {meta.label}
            </span>
          );
        })}
      </section>

      <section className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by broker name or platform (MT4, MT5, WebSocket…)"
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as BrokerCategory | "all")}
          className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
        >
          {ALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All categories" : c}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as BrokerStatus | "all")}
          className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
        >
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : STATUS_META[s].label}
            </option>
          ))}
        </select>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted">No brokers match those filters.</p>
        ) : (
          filtered.map((b) => {
            const meta = STATUS_META[b.status];
            return (
              <article
                key={b.id}
                className={`rounded-2xl border p-4 ${meta.bg}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 font-display text-lg tracking-wider">
                      <span aria-hidden>{meta.dot}</span>
                      <span className="truncate">{b.name}</span>
                    </h2>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {b.prop_firm ? (
                        <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-orange-300">
                          🟠 Prop Firm
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] uppercase tracking-wider ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                  </div>
                  {b.website ? (
                    <a
                      href={b.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="shrink-0 text-xs text-muted underline hover:text-white"
                    >
                      Visit →
                    </a>
                  ) : null}
                </div>

                <p className="mt-3 text-xs leading-relaxed text-white/80">
                  {b.notes}
                </p>

                {b.platform.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {b.platform.map((p) => (
                      <span
                        key={p}
                        className="rounded border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-mono"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1">
                  {b.categories.map((c) => (
                    <span
                      key={c}
                      className="rounded bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted"
                    >
                      {c}
                    </span>
                  ))}
                </div>

                {b.connectPath || b.eaDownload ? (
                  <div className="mt-3 flex justify-end">
                    {b.connectPath ? (
                      <Link
                        href={b.connectPath as Route<string>}
                        className="inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
                      >
                        Connect →
                      </Link>
                    ) : (
                      <Link
                        href={"/ea-setup" as Route<string>}
                        className="inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                      >
                        Install EA →
                      </Link>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </section>

      <UnlistedBrokerChecker />
      <BrokerSubmissionForm />
    </main>
  );
}
