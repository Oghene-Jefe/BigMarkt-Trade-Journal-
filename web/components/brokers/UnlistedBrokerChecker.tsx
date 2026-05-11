"use client";

import { useState } from "react";

type Step = 0 | 2 | "green" | "yellow" | "red";

export default function UnlistedBrokerChecker() {
  const [step, setStep] = useState<Step>(0);

  return (
    <div className="rounded-2xl border border-white/10 bg-panel p-6">
      <h3 className="font-display text-xl tracking-widest text-gold">
        BROKER NOT LISTED?
      </h3>
      <p className="mt-1 text-xs text-muted">
        Answer a couple of questions and we'll tell you what's possible.
      </p>

      <div className="mt-5 space-y-4">
        {step === 0 && (
          <Question
            text="Does your broker support MT4 or MT5?"
            onYes={() => setStep("green")}
            onNo={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <Question
            text="Does your broker offer a public API or WebSocket feed?"
            onYes={() => setStep("yellow")}
            onNo={() => setStep("red")}
          />
        )}

        {step === "green" && (
          <Result tone="green" title="You're good — our EA will work.">
            Install our MT4/MT5 EA on any chart in your terminal. Every fill is
            captured in real time and journaled with a verified trust badge.
          </Result>
        )}

        {step === "yellow" && (
          <Result tone="yellow" title="Probably workable — send us the docs.">
            Email a link to your broker's public API or WebSocket documentation
            to{" "}
            <a
              href="mailto:support@bigmarkt.co"
              className="underline hover:text-gold"
            >
              support@bigmarkt.co
            </a>
            . If the endpoints expose order history we'll build an integration.
          </Result>
        )}

        {step === "red" && (
          <Result tone="red" title="Manual logging only.">
            Without MT4/MT5 or a public API there's no way for us to read your
            fills. You can still journal manually — trades will carry the
            'manual' trust badge instead of the verified one.
          </Result>
        )}

        {step !== 0 && (
          <button
            onClick={() => setStep(0)}
            className="text-xs text-muted underline hover:text-white"
          >
            ← Start over
          </button>
        )}
      </div>
    </div>
  );
}

function Question({
  text,
  onYes,
  onNo,
}: {
  text: string;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div>
      <p className="text-sm">{text}</p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={onYes}
          className="rounded-lg border border-white/10 bg-black/40 px-4 py-1.5 text-xs font-semibold hover:border-emerald-500/50 hover:text-emerald-400"
        >
          YES
        </button>
        <button
          onClick={onNo}
          className="rounded-lg border border-white/10 bg-black/40 px-4 py-1.5 text-xs font-semibold hover:border-rose-500/50 hover:text-rose-400"
        >
          NO
        </button>
      </div>
    </div>
  );
}

function Result({
  tone,
  title,
  children,
}: {
  tone: "green" | "yellow" | "red";
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    yellow: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    red: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <p className="font-semibold text-sm">{title}</p>
      <p className="mt-1 text-xs leading-relaxed">{children}</p>
    </div>
  );
}
