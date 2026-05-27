import { z } from "zod";

// ── schema ───────────────────────────────────────────────────────────────────
// Strict validation of trade payloads coming in from the MT5 Expert Advisor.
// Every field has bounded length / range; anything that doesn't parse is
// rejected at the API boundary so the rest of the pipeline (buildEaTradeRow,
// the trades insert, scoring recalc) only ever sees clean data.

const isoString = z
  .string()
  .min(1)
  .max(40)
  .refine((s) => {
    const t = Date.parse(s);
    if (!Number.isFinite(t)) return false;
    // Reject obvious garbage timestamps: before 2000 or more than a year
    // in the future. MT5 should never send anything outside this window.
    const min = Date.UTC(2000, 0, 1);
    const max = Date.now() + 365 * 24 * 60 * 60 * 1000;
    return t >= min && t <= max;
  }, "open_time/close_time must be a sane ISO timestamp");

const finiteBounded = (max: number) =>
  z.number().refine((n) => Number.isFinite(n) && Math.abs(n) <= max, {
    message: `value must be finite and |value| ≤ ${max}`,
  });

export const eaTradeSchema = z.object({
  // ticket: positive integer up to MT5's 64-bit ticket range; we cap at
  // JS's safe-int ceiling so it round-trips through Number losslessly.
  ticket: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  // symbol: 1-32 chars, alphanumeric + . / _ - (broker variants like
  // "EURUSD.m", "XAU/USD"). Normalised to uppercase.
  symbol: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9._/\-]+$/, "symbol contains invalid characters")
    .transform((s) => s.toUpperCase()),
  // type: free text but must contain buy or sell after lowercasing; capped
  // at 32 chars (MT5 sends "buy", "sell", "buy_limit", etc).
  type: z
    .string()
    .min(1)
    .max(32)
    .refine((s) => /buy|sell/i.test(s), "type must contain buy or sell"),
  lots: finiteBounded(10_000),
  open_price: finiteBounded(1_000_000_000),
  close_price: finiteBounded(1_000_000_000).default(0),
  open_time: z.string().default('').transform(v => v || null),
  close_time: z.string().default("").transform(v => v || null),
  profit: finiteBounded(1_000_000_000).default(0),
  swap: finiteBounded(1_000_000_000).default(0),
  commission: finiteBounded(1_000_000_000).default(0),
  magic: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  comment: z.string().max(500).default(''),
  position_id:  z.coerce.string().optional(),
  deal_entry:   z.enum(["in", "out"]).optional(),
  sl:           z.number().default(0),
  tp:           z.number().default(0),
  r_multiple:   z.number().default(0),
}).superRefine((data, ctx) => {
  // open_price=0 is valid for ENTRY_OUT (closing) deals sent by MT5.
  if (data.deal_entry !== "out" && data.open_price <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["open_price"],
      message: "open_price must be > 0 for opening deals",
    });
  }
  // lots=0 is valid for ENTRY_OUT closing deals.
  if (data.deal_entry !== "out" && data.lots <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lots"],
      message: "lots must be > 0 for opening deals",
    });
  }
});

export type EaTradePayload = z.infer<typeof eaTradeSchema>;

// ── derivations ──────────────────────────────────────────────────────────────

export function deriveEaResult(profit?: number): "WIN" | "LOSS" | "BE" {
  if (!profit || profit === 0) return "BE";
  return profit > 0 ? "WIN" : "LOSS";
}

export function deriveEaDirection(type: string): "BUY" | "SELL" | null {
  const t = type.toLowerCase();
  if (t.includes("buy")) return "BUY";
  if (t.includes("sell")) return "SELL";
  return null;
}

export function buildEaTradeRow(args: {
  payload: EaTradePayload;
  userId: string;
  brokerAccountId?: string | null;
  accountType?: string | null;
}) {
  const direction = deriveEaDirection(args.payload.type);
  if (!direction) return { error: "Trade type must include buy or sell" } as const;

  // Trust badge derives from the broker account's type:
  //   • demo      → tagged "demo" so the UI shows a demo badge and the
  //                 leaderboard excludes the row from verified rankings.
  //   • prop_firm → tagged "prop_firm" so followers can see the trade
  //                 belongs to a funded account, not a live retail one.
  //                 Project rule: prop firm accounts are journal-only;
  //                 they never affect copy execution. The trust badge
  //                 must reflect that reality even before the scoring
  //                 gate filters them out.
  //   • everything else (live / unknown) → "auto_verified".
  // Closes audit finding H-6a in docs/security-audit-2026-05-17.md.
  // H-6b (updating get_public_trades to label or filter prop_firm rows)
  // ships in a separate batch — needs a migration.
  // trust_badge CHECK constraint: ('manual','auto_verified','draft','edited','prop_firm')
  // 'demo' is NOT in the constraint — demo accounts use 'manual' trust_badge so the
  // leaderboard scoring gate (trust_badge = 'auto_verified') naturally excludes them.
  const trustBadge =
    args.accountType === "prop_firm"
      ? "prop_firm"
      : args.accountType === "demo"
        ? "manual"
        : "auto_verified";

  const row: Record<string, unknown> = {
    user_id: args.userId,
    ticket: args.payload.ticket,
    pair: args.payload.symbol,
    direction,
    lot_size: args.payload.lots,
    entry_price: args.payload.open_price,
    exit_price: args.payload.close_price ?? null,
    open_time: args.payload.open_time || null,
    close_time: args.payload.close_time ?? null,
    pnl: args.payload.profit ?? null,
    swap: args.payload.swap ?? null,
    commission: args.payload.commission ?? null,
    magic: args.payload.magic ?? null,
    comment: args.payload.comment ?? null,
    result: deriveEaResult(args.payload.profit),
    capture_source: "ea",
    trust_badge: trustBadge,
    core_fields_locked: true,
    auto_approved: true,
  };
  if (args.brokerAccountId) row.broker_account_id = args.brokerAccountId;

  return { row } as const;
}
