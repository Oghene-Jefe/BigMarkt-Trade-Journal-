"use client";

import { useEffect, useState } from "react";

// Three-mode theme picker:
//   "light" — force light, ignore OS
//   "dark"  — force dark, ignore OS (default if unset)
//   "auto"  — follow `prefers-color-scheme: dark` (the OS sets this,
//             and modern OSes can schedule it to switch at sunset)
//
// Persistence: localStorage key `bm_theme`.
// FOUC: the inline init script in app/layout.tsx applies the class
// before first paint; this component just keeps it in sync after
// hydration + handles toggle clicks.

export type Theme = "light" | "dark" | "auto";

export const THEME_STORAGE_KEY = "bm_theme";

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "auto") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function applyTheme(theme: Theme) {
  const resolved = resolveTheme(theme);
  if (resolved === "light") {
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.remove("light");
  }
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "auto";
  const v = window.localStorage.getItem(THEME_STORAGE_KEY);
  return v === "light" || v === "dark" || v === "auto" ? v : "auto";
}

type Variant = "inline" | "stacked";

export default function ThemeToggle({ variant = "inline" }: { variant?: Variant }) {
  // Default to "auto" on first server render; the useEffect below reads
  // the real stored preference. The init script already set the class
  // pre-hydration, so the visual state is correct even before this
  // useEffect fires — only the button highlight depends on `theme`.
  const [theme, setTheme] = useState<Theme>("auto");

  // Read stored preference after hydration.
  useEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  // When theme changes (via user click), persist + re-apply.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    applyTheme(theme);
  }, [theme]);

  // In "auto" mode, follow OS preference changes (e.g. user switches OS
  // dark mode mid-session, or sunset triggers in macOS Auto schedule).
  useEffect(() => {
    if (theme !== "auto" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("auto");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const containerClass =
    variant === "stacked"
      ? "flex flex-col gap-1"
      : "inline-flex items-center gap-1 rounded-md border border-white/10 bg-bg/40 p-0.5";

  return (
    <div role="radiogroup" aria-label="Theme" className={containerClass}>
      <Option current={theme} value="light" label="Light" icon="☀" onSelect={setTheme} variant={variant} />
      <Option current={theme} value="dark" label="Dark" icon="☾" onSelect={setTheme} variant={variant} />
      <Option current={theme} value="auto" label="Auto" icon="⌖" onSelect={setTheme} variant={variant} />
    </div>
  );
}

function Option({
  current,
  value,
  label,
  icon,
  onSelect,
  variant,
}: {
  current: Theme;
  value: Theme;
  label: string;
  icon: string;
  onSelect: (t: Theme) => void;
  variant: Variant;
}) {
  const active = current === value;
  const base = "flex items-center gap-2 text-xs transition-colors";
  const inline = `${base} rounded px-2 py-1 ${active ? "bg-gold/20 text-gold" : "text-muted hover:text-white"}`;
  const stacked = `${base} rounded-md px-3 py-2 ${active ? "bg-gold/15 text-gold" : "text-muted hover:bg-white/5 hover:text-white"}`;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onSelect(value)}
      className={variant === "stacked" ? stacked : inline}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
