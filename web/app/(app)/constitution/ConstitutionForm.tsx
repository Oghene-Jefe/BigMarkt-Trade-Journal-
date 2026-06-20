"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, X, ShieldCheck, Info } from "lucide-react";
import { INSTRUMENTS } from "@/lib/pip-values";
import { fmtMoney } from "@/lib/format";
import { Button } from "@/components/ui";
import { upsertConstitutionAction, type ConstitutionActionState } from "./actions";

export type CustomRule = { id: string; text: string };

export type ConstitutionData = {
  is_active: boolean;
  max_risk_pct: number | null;
  require_stop_loss: boolean;
  max_trades_per_day: number | null;
  allowed_instruments: string[] | null;
  min_rr: number | null;
  max_daily_loss_pct: number | null;
  risk_mode: "trailing" | "static";
  risk_baseline: number | null;
  adherence_visibility: "private" | "public";
  custom_rules: CustomRule[];
};

const inputCls =
  "w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-gold disabled:opacity-40";

function numStr(n: number | null): string {
  return n == null ? "" : String(n);
}

export default function ConstitutionForm({
  data,
  startingBalance,
}: {
  data: ConstitutionData;
  startingBalance: number | null;
}) {
  const [state, formAction, pending] = useActionState<ConstitutionActionState, FormData>(
    upsertConstitutionAction,
    {},
  );

  const [isActive, setIsActive] = useState(data.is_active);

  // System rules — each numeric rule has an enable toggle + value.
  const [maxRiskOn, setMaxRiskOn] = useState(data.max_risk_pct != null);
  const [maxRisk, setMaxRisk] = useState(numStr(data.max_risk_pct));
  const [requireSL, setRequireSL] = useState(data.require_stop_loss);
  const [maxTradesOn, setMaxTradesOn] = useState(data.max_trades_per_day != null);
  const [maxTrades, setMaxTrades] = useState(numStr(data.max_trades_per_day));
  const [minRrOn, setMinRrOn] = useState(data.min_rr != null);
  const [minRr, setMinRr] = useState(numStr(data.min_rr));
  const [maxDailyOn, setMaxDailyOn] = useState(data.max_daily_loss_pct != null);
  const [maxDaily, setMaxDaily] = useState(numStr(data.max_daily_loss_pct));

  const [instrOn, setInstrOn] = useState(
    !!data.allowed_instruments && data.allowed_instruments.length > 0,
  );
  const [instruments, setInstruments] = useState<Set<string>>(
    new Set(data.allowed_instruments ?? []),
  );

  const [riskMode, setRiskMode] = useState<"trailing" | "static">(data.risk_mode);
  const [riskBaseline, setRiskBaseline] = useState(numStr(data.risk_baseline));

  const [visibility, setVisibility] = useState<"private" | "public">(data.adherence_visibility);

  const [customRules, setCustomRules] = useState<CustomRule[]>(data.custom_rules);
  const [newRule, setNewRule] = useState("");

  // Live risk preview: baseline = static baseline if static, else starting balance.
  const previewBaseline = useMemo(() => {
    if (riskMode === "static") {
      const n = Number(riskBaseline);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return startingBalance && startingBalance > 0 ? startingBalance : null;
  }, [riskMode, riskBaseline, startingBalance]);

  const riskPreview = useMemo(() => {
    const pct = Number(maxRisk);
    if (!maxRiskOn || !Number.isFinite(pct) || pct <= 0 || previewBaseline == null) return null;
    return (previewBaseline * pct) / 100;
  }, [maxRiskOn, maxRisk, previewBaseline]);

  function toggleInstrument(sym: string) {
    setInstruments((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });
  }

  function addCustomRule() {
    const text = newRule.trim();
    if (!text) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${customRules.length}`;
    setCustomRules((r) => [...r, { id, text }]);
    setNewRule("");
  }

  const instrumentsJson = JSON.stringify(instrOn ? [...instruments] : []);
  const customRulesJson = JSON.stringify(
    customRules.map((r) => ({ id: r.id, text: r.text })),
  );

  return (
    <form action={formAction} className="space-y-5">
      {/* Hidden serialized fields */}
      <input type="hidden" name="allowed_instruments" value={instrumentsJson} />
      <input type="hidden" name="custom_rules" value={customRulesJson} />
      {isActive ? <input type="hidden" name="is_active" value="true" /> : null}
      {requireSL ? <input type="hidden" name="require_stop_loss" value="true" /> : null}
      <input type="hidden" name="risk_mode" value={riskMode} />
      <input type="hidden" name="adherence_visibility" value={visibility} />

      {/* Master toggle */}
      <Card>
        <Toggle
          checked={isActive}
          onChange={setIsActive}
          label="Constitution active"
          hint="When on, we check your trades against these rules and flag deviations."
          icon={<ShieldCheck size={16} className="text-gold" aria-hidden />}
        />
      </Card>

      {/* System rules */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">System rules</h2>

        <RuleCard
          on={requireSL}
          onToggle={setRequireSL}
          title="Require a stop loss"
          desc="Flag any trade opened without a stop loss."
        />

        <RuleCard
          on={maxRiskOn}
          onToggle={setMaxRiskOn}
          title="Max risk per trade"
          desc="Flag trades risking more than this % of your balance."
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              name={maxRiskOn ? "max_risk_pct" : undefined}
              disabled={!maxRiskOn}
              value={maxRisk}
              onChange={(e) => setMaxRisk(e.target.value)}
              placeholder="2"
              className={inputCls}
            />
            <span className="text-sm text-muted">%</span>
          </div>
          {riskPreview != null ? (
            <p className="mt-2 text-xs text-muted">
              {maxRisk}% of {fmtMoney(previewBaseline)} ≈{" "}
              <span className="text-gold">{fmtMoney(riskPreview)}</span>
              {riskMode === "trailing" ? " (preview uses your starting balance)" : ""}
            </p>
          ) : maxRiskOn ? (
            <p className="mt-2 text-xs text-muted">Set a baseline to preview the money risk.</p>
          ) : null}
        </RuleCard>

        <RuleCard
          on={minRrOn}
          onToggle={setMinRrOn}
          title="Minimum reward:risk"
          desc="Flag trades whose planned R:R is below this."
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              name={minRrOn ? "min_rr" : undefined}
              disabled={!minRrOn}
              value={minRr}
              onChange={(e) => setMinRr(e.target.value)}
              placeholder="2"
              className={inputCls}
            />
            <span className="text-sm text-muted">: 1</span>
          </div>
        </RuleCard>

        <RuleCard
          on={maxTradesOn}
          onToggle={setMaxTradesOn}
          title="Max trades per day"
          desc="Flag once you exceed this many trades in a day."
        >
          <input
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            name={maxTradesOn ? "max_trades_per_day" : undefined}
            disabled={!maxTradesOn}
            value={maxTrades}
            onChange={(e) => setMaxTrades(e.target.value)}
            placeholder="3"
            className={inputCls}
          />
        </RuleCard>

        <RuleCard
          on={maxDailyOn}
          onToggle={setMaxDailyOn}
          title="Max daily loss"
          desc="Flag trades opened after the day's realized loss exceeds this %."
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              name={maxDailyOn ? "max_daily_loss_pct" : undefined}
              disabled={!maxDailyOn}
              value={maxDaily}
              onChange={(e) => setMaxDaily(e.target.value)}
              placeholder="5"
              className={inputCls}
            />
            <span className="text-sm text-muted">%</span>
          </div>
        </RuleCard>

        <RuleCard
          on={instrOn}
          onToggle={setInstrOn}
          title="Allowed instruments"
          desc="Flag trades on any instrument not in your list."
        >
          <div className="space-y-3">
            {Object.entries(INSTRUMENTS).map(([group, items]) => (
              <div key={group}>
                <p className="mb-1 text-[10px] uppercase tracking-widest text-muted">{group}</p>
                <div className="flex flex-wrap gap-2">
                  {items.map((i) => {
                    const sel = instruments.has(i.symbol);
                    return (
                      <button
                        key={i.symbol}
                        type="button"
                        disabled={!instrOn}
                        onClick={() => toggleInstrument(i.symbol)}
                        className={`rounded-full border px-3 py-1 text-xs transition disabled:opacity-40 ${
                          sel
                            ? "border-gold bg-gold/15 text-gold"
                            : "border-white/15 text-muted hover:border-white/30"
                        }`}
                      >
                        {i.symbol}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </RuleCard>
      </section>

      {/* Risk baseline mode */}
      <Card>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
          Risk baseline
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ModeButton
            active={riskMode === "trailing"}
            onClick={() => setRiskMode("trailing")}
            title="Trailing"
            desc="Balance at the time each trade opened."
          />
          <ModeButton
            active={riskMode === "static"}
            onClick={() => setRiskMode("static")}
            title="Static"
            desc="A fixed baseline you set below."
          />
        </div>
        {riskMode === "static" ? (
          <div className="mt-3">
            <label className="mb-1 block text-xs uppercase tracking-widest text-muted">
              Static baseline (USD)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              name="risk_baseline"
              value={riskBaseline}
              onChange={(e) => setRiskBaseline(e.target.value)}
              placeholder="10000"
              className={inputCls}
            />
          </div>
        ) : null}
      </Card>

      {/* Custom rules */}
      <Card>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Custom rules
        </h2>
        <p className="mt-1 flex items-start gap-1.5 text-xs text-muted">
          <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
          <span>Self-attested reminders — we don&apos;t auto-check these.</span>
        </p>
        <ul className="mt-3 space-y-2">
          {customRules.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 py-2">
              <span className="flex-1 text-sm text-white">{r.text}</span>
              <button
                type="button"
                aria-label="Remove rule"
                onClick={() => setCustomRules((rs) => rs.filter((x) => x.id !== r.id))}
                className="rounded p-1 text-muted hover:text-loss"
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newRule}
            maxLength={280}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addCustomRule(); }
            }}
            placeholder="e.g. No trading during high-impact news"
            className={inputCls}
          />
          <button
            type="button"
            onClick={addCustomRule}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/15 px-3 text-sm text-muted hover:border-gold hover:text-gold"
          >
            <Plus size={14} aria-hidden />
            Add
          </button>
        </div>
      </Card>

      {/* Adherence visibility */}
      <Card>
        <Toggle
          checked={visibility === "public"}
          onChange={(v) => setVisibility(v ? "public" : "private")}
          label="Show adherence publicly"
          hint="Off (private): only you see your adherence. On (public): your adherence score can appear on your public profile."
        />
      </Card>

      {state.error ? <p className="text-sm text-loss">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-win">{state.ok}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save constitution"}
        </Button>
      </div>
    </form>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-white/10 bg-panel p-4">{children}</div>;
}

function RuleCard({
  on, onToggle, title, desc, children,
}: {
  on: boolean;
  onToggle: (v: boolean) => void;
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-panel p-4">
      <Toggle checked={on} onChange={onToggle} label={title} hint={desc} />
      {on && children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

function Toggle({
  checked, onChange, label, hint, icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          {icon}
          {label}
        </span>
        {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="block h-6 w-10 rounded-full bg-white/15 transition peer-checked:bg-gold" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

function ModeButton({
  active, onClick, title, desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md border p-3 text-left transition ${
        active ? "border-gold bg-gold/10" : "border-white/15 hover:border-white/30"
      }`}
    >
      <div className={`text-sm font-medium ${active ? "text-gold" : "text-white"}`}>{title}</div>
      <div className="mt-0.5 text-xs text-muted">{desc}</div>
    </button>
  );
}
