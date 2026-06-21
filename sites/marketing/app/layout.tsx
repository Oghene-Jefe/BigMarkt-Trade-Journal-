import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./_components/Navbar";
import Footer from "./_components/Footer";

export const metadata: Metadata = {
  title: {
    default: "BigMarkt — The Verified Trading Journal",
    template: "%s — BigMarkt",
  },
  description:
    "Auto-capture trades, review performance, and build a cleaner trading record.",
  metadataBase: new URL("https://www.bigmarkt.co"),
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
    title: "BigMarkt — The Verified Trading Journal",
    description:
      "Auto-capture trades, review performance, and build a cleaner trading record.",
    url: "https://www.bigmarkt.co",
    siteName: "BigMarkt",
    images: ["/images/bigmarkt-logo.png"],
  },
  twitter: {
    card: "summary_large_image",
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
