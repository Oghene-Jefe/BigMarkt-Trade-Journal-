import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BigMarkt Trade Journal",
  description: "Built for traders, by traders.",
};

// Run synchronously before first paint to apply the right theme class.
// Without this, the page paints in default-dark, then flickers to light
// once the ThemeToggle's useEffect runs. The script:
//   1. reads localStorage('bm_theme'); falls back to 'auto'
//   2. resolves 'auto' against the OS prefers-color-scheme media query
//   3. adds `.light` to <html> if the resolved theme is light
//
// Wrapped in try/catch so a broken localStorage (private mode, etc)
// doesn't crash the page — it just falls through to dark default.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('bm_theme')||'auto';var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var light=t==='light'||(t==='auto'&&!d);if(light)document.documentElement.classList.add('light');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline pre-paint theme bootstrap. suppressHydrationWarning on
            <html> above silences React's warning about the class attribute
            differing between server and client (the script adds the class
            before React hydrates). */}
        <script>{THEME_INIT_SCRIPT}</script>
      </head>
      <body className="min-h-screen bg-bg text-white antialiased">{children}</body>
    </html>
  );
}
