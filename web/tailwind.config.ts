import type { Config } from "tailwindcss";

// Tokens become CSS variables (rgb triples) so a single `.light` class
// on <html> can swap the entire palette. The `<alpha-value>` placeholder
// is Tailwind 3's clean way to keep opacity modifiers like `bg-bg/50`
// working under variable colors.
//
// Brand colours (gold/win/loss) stay constant across themes — they're
// the BigMarkt identity, not chrome.
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        panel: "rgb(var(--color-panel) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        gold: "#D4AF37",
        win: "#22C55E",
        loss: "#EF4444",
      },
      fontFamily: {
        display: ["var(--font-bebas)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
