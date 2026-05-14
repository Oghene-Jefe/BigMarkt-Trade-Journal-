import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BigMarkt Trade Journal",
  description: "Built for traders, by traders.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-white antialiased">{children}</body>
    </html>
  );
}
