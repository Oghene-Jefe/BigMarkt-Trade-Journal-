import type { Config } from "tailwindcss";

// Tokens lifted from the existing static app's css/style.css so the rebuild
// keeps visual continuity with the BigMarkt brand (gold on near-black).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0A",
        panel: "#141414",
        gold: "#D4AF37",
        win: "#22C55E",
        loss: "#EF4444",
        muted: "#888888",
      },
      fontFamily: {
        display: ["var(--font-bebas)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
