import type { ReactNode } from "react";

type Props = {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  tone?: "neutral" | "win" | "loss";
};

const tones = {
  neutral: "text-white",
  win: "text-win",
  loss: "text-loss",
};

export function MetricCard({ label, value, delta, tone = "neutral" }: Props) {
  return (
    <div className="rounded-md border border-white/10 bg-panel/60 p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
      {delta ? <div className="mt-1 text-xs text-muted">{delta}</div> : null}
    </div>
  );
}
