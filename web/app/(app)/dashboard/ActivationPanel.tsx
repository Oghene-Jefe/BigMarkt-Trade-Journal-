import Link from "next/link";
import type { Route } from "next";
import { CheckCircle2, Circle, ArrowRight, Zap } from "lucide-react";
import { Section } from "@/components/ui";
import type { ActivationSummary } from "@/lib/activation";

type Props = {
  summary: ActivationSummary;
};

/**
 * First-time activation checklist.
 *
 * Renders nothing once activation is complete (summary.nextStep === null).
 * The dashboard parent is also responsible for hiding the legacy
 * `<Banners />` until this panel disappears, so users never see two
 * surfaces competing for the same first action.
 *
 * Optional steps render with an "Optional" label and never affect the
 * progress percent or the primary CTA — see docs/claude-activation-build-proposal.md
 * Section 11 (codex tweak 3).
 */
export default function ActivationPanel({ summary }: Props) {
  // Hide entirely once every required step is complete.
  if (summary.nextStep === null) return null;

  const { completeCount, totalCount, percent, nextStep, steps } = summary;

  return (
    <Section>
      <div className="flex flex-col gap-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Zap size={18} aria-hidden className="mt-0.5 text-gold" />
            <div>
              <h2 className="text-sm font-medium text-white">Activation</h2>
              <p className="mt-0.5 text-xs text-muted">
                Complete the setup path that gets your journal useful.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs tabular-nums text-muted">
              {completeCount} of {totalCount} complete
            </span>
            <span className="text-xs tabular-nums text-gold">{percent}%</span>
          </div>
        </header>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Activation progress"
          className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
        >
          <div
            className="h-full bg-gold transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>

        <Link
          href={nextStep.href as Route}
          className="inline-flex items-center justify-between gap-3 rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold hover:bg-gold/15"
        >
          <span className="flex items-center gap-2">
            <ArrowRight size={14} aria-hidden />
            <span className="font-medium">{nextStep.title}</span>
          </span>
          <span className="text-xs text-gold/70">Continue</span>
        </Link>

        <ul className="divide-y divide-white/5 text-sm">
          {steps.map((step) => (
            <li
              key={step.key}
              className="flex items-start justify-between gap-3 py-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                {step.complete ? (
                  <CheckCircle2
                    size={16}
                    aria-hidden
                    className="mt-0.5 shrink-0 text-win"
                  />
                ) : (
                  <Circle
                    size={16}
                    aria-hidden
                    className="mt-0.5 shrink-0 text-muted"
                  />
                )}
                <div className="min-w-0">
                  <p
                    className={`font-medium ${
                      step.complete ? "text-muted line-through" : "text-white"
                    }`}
                  >
                    {step.title}
                    {step.optional ? (
                      <span className="ml-2 rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                        Optional
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{step.body}</p>
                </div>
              </div>
              {step.complete ? null : (
                <Link
                  href={step.href as Route}
                  className="shrink-0 text-xs text-gold hover:underline"
                  aria-label={`Go to: ${step.title}`}
                >
                  Open
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
