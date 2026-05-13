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
  title: "BigMarkt — The Verified Trading Journal",
  description:
    "Auto-capture every trade from your broker. Build a verified public record. Follow the best traders in the world.",
  metadataBase: new URL("https://bigmarkt.co"),
  openGraph: {
    title: "BigMarkt — The Verified Trading Journal",
    description:
      "Auto-capture every trade. Build a verified public record. Follow the best traders.",
    url: "https://bigmarkt.co",
    siteName: "BigMarkt",
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
