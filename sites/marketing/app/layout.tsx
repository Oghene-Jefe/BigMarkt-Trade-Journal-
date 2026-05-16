import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./_components/Navbar";
import Footer from "./_components/Footer";

export const metadata: Metadata = {
  title: "BigMarkt — The Verified Trading Journal",
  description:
    "Auto-capture trades, review performance, and build a cleaner trading record.",
  metadataBase: new URL("https://bigmarkt.co"),
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
    url: "https://bigmarkt.co",
    siteName: "BigMarkt",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-[#0a0a0a] text-white antialiased">
        <Navbar />
        <main className="flex-1 pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
