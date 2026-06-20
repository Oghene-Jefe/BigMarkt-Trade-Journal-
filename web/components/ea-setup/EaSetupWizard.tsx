"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Download, CheckCircle2, Circle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { EaTokenRow, BrokerAccountOption, WsStatus } from "@/app/(app)/ea-setup/page";

// ─── Step indicator ──────────────────────────────────────────────────────────

function StepIndicator({ current, total, completed }: { current: number; total: number; completed: Set<number> }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done = completed.has(n);
        const active = n === current;
        return (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors ${
                done
                  ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                  : active
                  ? "border-gold/50 bg-gold/10 text-gold"
                  : "border-white/20 bg-black/20 text-muted"
              }`}
            >
              {done ? <CheckCircle2 size={14} aria-hidden /> : n}
            </div>
            {n < total && (
              <div
                className={`h-px w-6 sm:w-10 transition-colors ${
                  done ? "bg-emerald-500/40" : "bg-white/10"
                }`}
              />
            )}
          </div>
        );
      })}
      <span className="ml-2 text-xs text-muted">Step {current} of {total}</span>
    </div>
  );
}

// ─── Navigation buttons ───────────────────────────────────────────────────────

function NavButtons({
  step,
  total,
  onPrev,
  onNext,
}: {
  step: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-6 flex items-center justify-between">
      <button
        type="button"
        onClick={onPrev}
        disabled={step === 1}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-4 py-2 text-sm text-muted hover:text-white disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronLeft size={14} aria-hidden />
        Previous
      </button>
      {step < total ? (
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1.5 rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold/90"
        >
          Next
          <ChevronRight size={14} aria-hidden />
        </button>
      ) : (
        <span className="text-sm text-emerald-400 font-medium">Setup complete!</span>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Mono({ children }: { children: ReactNode }) {
  return <code className="rounded bg-black/40 px-1 font-mono text-xs">{children}</code>;
}

function TipBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-md border border-gold/30 bg-gold/5 px-4 py-3 text-xs text-gold/80">
      {children}
    </div>
  );
}

function WarningBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
      {children}
    </div>
  );
}

// ─── Step 1: Download ─────────────────────────────────────────────────────────

function StepDownload() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Click to download the compiled EA file. No MetaEditor or coding required.
      </p>
      <a
        href="/downloads/BigMarkt_EA_v2.5.1.ex5"
        download
        className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold/90"
      >
        <Download size={14} aria-hidden />
        <span>Download BigMarkt EA v2.5.1</span>
      </a>
      <p className="text-xs text-muted">
        This file works on any MT5 terminal — demo or live.
      </p>
    </div>
  );
}

// ─── Step 2: Install ──────────────────────────────────────────────────────────

function StepInstall() {
  return (
    <div className="space-y-3">
      <ol className="space-y-2 text-sm text-white/80">
        {[
          <>Open MT5 and click <em>File → Open Data Folder</em></>,
          <>Navigate to <Mono>MQL5 → Experts</Mono></>,
          <>Drag and drop <Mono>BigMarkt_EA_v2.5.1.ex5</Mono> into that folder</>,
          <>Restart MT5 or press <Mono>F5</Mono> to refresh the Navigator panel</>,
          <>Find <Mono>BigMarkt EA</Mono> under <em>Expert Advisors</em> in the Navigator</>,
        ].map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-[10px] font-medium text-muted">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <TipBox>
        Make sure <strong>AutoTrading</strong> is enabled in MT5 (green play button in toolbar)
      </TipBox>
    </div>
  );
}

// ─── Step 3: Configure (credentials) ─────────────────────────────────────────

function StepConfigure({
  EaTokenManagerComponent,
}: {
  EaTokenManagerComponent: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Copy all 3 values from below into the EA input fields when attaching it to a chart.
      </p>
      {EaTokenManagerComponent}
      <WarningBox>
        <strong>Never share your Signing Secret.</strong> It signs every trade sent to your journal.
      </WarningBox>
    </div>
  );
}

// ─── Step 4: Verify ───────────────────────────────────────────────────────────

type EaStatusResult = { connected: boolean; trade_count: number; last_trade_at: string | null } | null;

function StepVerify() {
  const [status, setStatus] = useState<EaStatusResult>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ea/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data as EaStatusResult);
      } else {
        setStatus(null);
      }
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10_000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return (
    <div className="space-y-4">
      <div
        className={`rounded-md border p-4 ${
          status?.connected
            ? "border-emerald-500/40 bg-emerald-500/10"
            : "border-amber-500/40 bg-amber-500/10"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              status?.connected ? "bg-emerald-500/20" : "bg-amber-500/20"
            }`}
          >
            {status?.connected ? (
              <CheckCircle2 size={18} className="text-emerald-400" aria-hidden />
            ) : (
              <div className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400" />
              </div>
            )}
          </div>
          <div>
            {status?.connected ? (
              <p className="text-sm font-medium text-emerald-300">
                EA connected — trades are flowing
              </p>
            ) : (
              <p className="text-sm font-medium text-amber-300">
                Waiting for first trade...
              </p>
            )}
            {!status?.connected && (
              <p className="mt-0.5 text-xs text-amber-300/70">
                Place a trade on your connected account to verify
              </p>
            )}
            {lastChecked && (
              <p className="mt-0.5 text-[10px] text-muted">
                Last checked: {lastChecked.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={checkStatus}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md border border-white/20 px-4 py-2 text-sm text-muted hover:text-white disabled:opacity-50"
      >
        <RefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden />
        Test connection
      </button>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

type Props = {
  EaTokenManagerComponent: ReactNode;
  tokens: EaTokenRow[];
  wsStatus: WsStatus | null;
  brokerAccounts: BrokerAccountOption[];
};

const STEPS = [
  { title: "Download the EA" },
  { title: "Install in MT5" },
  { title: "Enter your credentials" },
  { title: "Confirm connection" },
];

export default function EaSetupWizard({ EaTokenManagerComponent }: Props) {
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  const goNext = () => {
    setCompleted((prev) => new Set([...prev, step]));
    setStep((s) => Math.min(s + 1, STEPS.length));
  };

  const goPrev = () => {
    setStep((s) => Math.max(s - 1, 1));
  };

  const current = STEPS[step - 1];

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator current={step} total={STEPS.length} completed={completed} />

      {/* Step content card */}
      <section className="rounded-lg border border-white/10 bg-panel p-5">
        <header className="flex items-center gap-3 mb-6">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-xs font-medium text-gold">
            {step}
          </span>
          <h2 className="text-base font-medium text-white">{current.title}</h2>
        </header>

        {step === 1 && <StepDownload />}
        {step === 2 && <StepInstall />}
        {step === 3 && <StepConfigure EaTokenManagerComponent={EaTokenManagerComponent} />}
        {step === 4 && <StepVerify />}

        <NavButtons step={step} total={STEPS.length} onPrev={goPrev} onNext={goNext} />
      </section>
    </div>
  );
}
