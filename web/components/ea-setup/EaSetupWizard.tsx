"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Download, CheckCircle2, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { EaTokenRow, BrokerAccountOption, WsStatus } from "@/app/(app)/ea-setup/page";
import { Button, buttonClasses } from "@/components/ui/Button";

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
                  ? "border-win/50 bg-win/20 text-win"
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
                  done ? "bg-win/40" : "bg-white/10"
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
  connected,
}: {
  step: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  connected: boolean;
}) {
  const onFinalStep = step === total;
  return (
    <div className="mt-6 flex items-center justify-between">
      <Button variant="secondary" onClick={onPrev} disabled={step === 1} icon={<ChevronLeft size={14} aria-hidden />}>
        Previous
      </Button>
      {!onFinalStep ? (
        <Button onClick={onNext} icon={<ChevronRight size={14} aria-hidden />}>
          Next
        </Button>
      ) : connected ? (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-win">
          <CheckCircle2 size={16} aria-hidden />
          Setup complete
        </span>
      ) : (
        <span className="text-sm text-muted">Waiting for connection…</span>
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
    <div className="mt-4 rounded-md border border-loss/40 bg-loss/10 px-4 py-3 text-xs text-loss">
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
      <a href="/downloads/BigMarkt_EA_v2.5.1.ex5" download className={buttonClasses()}>
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

function StepVerify({
  connected,
  loading,
  lastChecked,
  onCheck,
}: {
  connected: boolean;
  loading: boolean;
  lastChecked: Date | null;
  onCheck: () => void;
}) {
  return (
    <div className="space-y-4">
      <div
        className={`rounded-md border p-4 ${
          connected
            ? "border-win/40 bg-win/10"
            : "border-gold/40 bg-gold/10"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              connected ? "bg-win/20" : "bg-gold/20"
            }`}
          >
            {connected ? (
              <CheckCircle2 size={18} className="text-win" aria-hidden />
            ) : (
              <div className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-gold" />
              </div>
            )}
          </div>
          <div>
            {connected ? (
              <p className="text-sm font-medium text-win">
                EA connected — trades are flowing
              </p>
            ) : (
              <p className="text-sm font-medium text-gold">
                Waiting for first trade...
              </p>
            )}
            {!connected && (
              <p className="mt-0.5 text-xs text-gold/70">
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

      <Button variant="secondary" onClick={onCheck} disabled={loading} icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden />}>
        Test connection
      </Button>
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

type EaStatusResult = { connected: boolean; trade_count: number; last_trade_at: string | null } | null;

const STEPS = [
  { title: "Download the EA" },
  { title: "Install in MT5" },
  { title: "Enter your credentials" },
  { title: "Confirm connection" },
];

const STEP_STORAGE_KEY = "ea-setup-step";

export default function EaSetupWizard({ EaTokenManagerComponent }: Props) {
  // Persist the current step across refresh via localStorage (simpler than a
  // URL param: no router plumbing, and the wizard isn't a deep-linked surface).
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  // ── Real connection status, lifted up so step-4 completion is gated by it ──
  const [status, setStatus] = useState<EaStatusResult>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const connected = status?.connected === true;

  const checkStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/ea/status");
      setStatus(res.ok ? ((await res.json()) as EaStatusResult) : null);
    } catch {
      setStatus(null);
    } finally {
      setStatusLoading(false);
      setLastChecked(new Date());
    }
  }, []);

  // Restore persisted step on mount.
  useEffect(() => {
    const saved = Number(localStorage.getItem(STEP_STORAGE_KEY));
    if (Number.isInteger(saved) && saved >= 1 && saved <= STEPS.length) {
      setStep(saved);
    }
  }, []);

  // Persist step changes.
  useEffect(() => {
    localStorage.setItem(STEP_STORAGE_KEY, String(step));
  }, [step]);

  // Poll connection status while the wizard is mounted so step 4 reflects
  // reality regardless of which step the user is viewing.
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10_000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  // Step 4 is only "completed" once a real connection is verified — never by
  // merely clicking Next (which is hidden on the final step anyway).
  useEffect(() => {
    if (connected) {
      setCompleted((prev) => (prev.has(STEPS.length) ? prev : new Set([...prev, STEPS.length])));
    } else {
      setCompleted((prev) => {
        if (!prev.has(STEPS.length)) return prev;
        const next = new Set(prev);
        next.delete(STEPS.length);
        return next;
      });
    }
  }, [connected]);

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
      <StepIndicator current={step} total={STEPS.length} completed={completed} />

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
        {step === 4 && (
          <StepVerify
            connected={connected}
            loading={statusLoading}
            lastChecked={lastChecked}
            onCheck={checkStatus}
          />
        )}

        <NavButtons step={step} total={STEPS.length} onPrev={goPrev} onNext={goNext} connected={connected} />
      </section>
    </div>
  );
}
