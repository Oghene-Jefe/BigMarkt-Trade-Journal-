import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./_components/Navbar";
import Footer from "./_components/Footer";

export const metadata: Metadata = {
  title: {
    default: "BigMarkt — The Verified Trading Journal for Serious Traders",
    template: "%s — BigMarkt",
  },
  description:
    "Log forex, gold, crypto and stock trades automatically from MT4/MT5. Build a verified performance record. Follow top traders. Free to start — bigmarkt.co",
  metadataBase: new URL("https://www.bigmarkt.co"),
  keywords: [
    "forex trading journal",
    "MT5 trading journal",
    "verified trading journal",
    "crypto trading journal",
    "stock trading journal",
    "gold trading journal",
    "XAUUSD journal",
    "trading performance tracker",
    "prop firm journal",
    "funded trader journal",
    "SMC trading journal",
    "ICT trading journal",
    "trading accountability",
    "trading constitution",
    "follow verified traders",
    "trading leaderboard",
    "best trading journal 2026",
  ],
  icons: {
    // First entry has no `media` so every browser/agent picks at least one
    // icon — including those that ignore prefers-color-scheme on favicons
    // (Safari historically) or that don't evaluate the media query at all
    // (preview/RSS crawlers). The two conditional entries override when
    // the user-agent honours the media query.
    icon: [
      { url: "/favicon-dark.svg", type: "image/svg+xml" },
      { url: "/favicon-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
      { url: "/favicon-light.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
    ],
  },
  openGraph: {
    title: "BigMarkt — The Verified Trading Journal for Serious Traders",
    description:
      "Log forex, gold, crypto and stock trades automatically from MT4/MT5. Build a verified performance record. Follow top traders. Free to start.",
    url: "https://www.bigmarkt.co",
    siteName: "BigMarkt",
    images: [{ url: "/images/bigmarkt-logo.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BigMarkt — The Verified Trading Journal for Serious Traders",
    description:
      "Log forex, gold, crypto and stock trades automatically from MT4/MT5. Build a verified performance record. Follow top traders. Free to start.",
    images: ["/images/bigmarkt-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-[#0a0a0a] text-white antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:bg-[#C9A84C] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main" className="flex-1 pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
