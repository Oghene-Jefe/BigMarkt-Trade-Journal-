import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "BigMarkt Trade Journal",
  description: "Built for traders, by traders.",
  icons: {
    icon: [
      // Browsers pick the variant whose `media` matches the OS/browser
      // theme. The legacy /favicon.ico stays as a fallback for browsers
      // that don't honour the SVG icon route (older Safari, RSS clients,
      // etc.) — listed last so the SVGs take precedence when supported.
      { url: "/favicon-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
      { url: "/favicon-light.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
  },
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
      <body className="min-h-screen bg-bg text-white antialiased">
        {/* Inline pre-paint theme bootstrap via next/script with the
            beforeInteractive strategy — Next emits this as a synchronous
            inline <script> placed before any other scripts, guaranteed
            to run before body paint. The plain <script>{...}</script>
            JSX form caused a visible dark flash on data-heavy refreshes
            (most noticeable on the news page) because React was
            injecting the script via DOM after paint.

            suppressHydrationWarning on <html> above silences React's
            warning about the class attribute differing between server
            and client (the script adds the class before hydration). */}
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
