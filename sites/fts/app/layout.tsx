import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./_components/Navbar";
import Footer from "./_components/Footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Free Trading Academy — FTS",
  description:
    "Learn to trade properly. No hype. No expensive courses. The education arm of BigMarkt.",
  metadataBase: new URL("https://fts.bigmarkt.co"),
  openGraph: {
    title: "Free Trading Academy — FTS",
    description:
      "Learn the craft. Build the record. Free forex education from BigMarkt.",
    url: "https://fts.bigmarkt.co",
    siteName: "FTS — Free Trading Academy",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[#0a0a0a] text-white antialiased">
        <Navbar />
        <main className="flex-1 pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
