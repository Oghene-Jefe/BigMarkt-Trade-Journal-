import "./globals.css";
import type { Metadata } from "next";
import { Bebas_Neue } from "next/font/google";

const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas" });

export const metadata: Metadata = {
  title: "BigMarkt Trade Journal",
  description: "Built for traders, by traders.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={bebas.variable}>
      <body className="min-h-screen bg-bg text-white antialiased">{children}</body>
    </html>
  );
}
