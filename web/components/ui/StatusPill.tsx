import type { ReactNode } from "react";

type Tone = "neutral" | "ok" | "warn" | "error" | "info";

const tones: Record<Tone, string> = {
  neutral: "border-white/15 text-muted",
  ok: "border-win/40 text-win",
  warn: "border-amber-400/40 text-amber-300",
  error: "border-loss/40 text-loss",
  info: "border-gold/40 text-gold",
};

type Props = {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function StatusPill({ tone = "neutral", icon, children, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs ${tones[tone]} ${className}`}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}
