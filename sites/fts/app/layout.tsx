import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./_components/Navbar";
import Footer from "./_components/Footer";

export const metadata: Metadata = {
  title: {
    default: "FTS — Free Trading Academy | Forex & SMC Education",
    template: "%s — FTS by BigMarkt",
  },
  description:
    "Free forex and SMC trading education. Learn order blocks, ICT concepts, risk management and trading psychology. Community of verified traders across Africa and beyond.",
  metadataBase: new URL("https://fts.bigmarkt.co"),
  keywords: [
    "free forex education",
    "SMC trading course",
    "ICT trading education",
    "forex trading Nigeria",
    "free trading academy",
    "order block trading",
    "smart money trading",
    "forex West Africa",
    "trading community Africa",
    "FTS trading",
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
    title: "FTS — Free Trading Academy | Forex & SMC Education",
    description:
      "Free forex and SMC trading education. Learn order blocks, ICT concepts, risk management and trading psychology. Community of verified traders across Africa and beyond.",
    url: "https://fts.bigmarkt.co",
    siteName: "FTS — Free Trading Academy",
    images: [{ url: "/images/bigmarkt-logo.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FTS — Free Trading Academy | Forex & SMC Education",
    description:
      "Free forex and SMC trading education. Learn order blocks, ICT concepts, risk management and trading psychology.",
    images: ["/images/bigmarkt-logo.png"],
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
