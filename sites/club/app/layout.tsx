import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./_components/Navbar";
import Footer from "./_components/Footer";

export const metadata: Metadata = {
  title: {
    default: "BigMarkt Club — Free Financial Education for Students",
    template: "%s — BigMarkt Club",
  },
  description:
    "Free financial literacy, trading skills and investment education for students. African roots. Global reach. Join BigMarkt Club.",
  metadataBase: new URL("https://club.bigmarkt.co"),
  keywords: [
    "financial education students",
    "free trading course students",
    "investment education Africa",
    "financial literacy youth",
    "student trading community",
    "bigmarkt club",
  ],
  verification: {
    google: "ysCDfQkvSTdp1V0PV5QkLilM8slrPpWL_5ef7fExhmI",
  },
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
    title: "BigMarkt Club",
    description:
      "Learn money. For real this time. Free to join. Built for students.",
    url: "https://club.bigmarkt.co",
    siteName: "BigMarkt Club",
    images: [{ url: "/images/bigmarkt-logo.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BigMarkt Club",
    description:
      "Learn money. For real this time. Free to join. Built for students.",
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
