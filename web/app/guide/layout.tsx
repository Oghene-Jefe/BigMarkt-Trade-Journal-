import type { Metadata } from "next";
import GuideShell from "@/components/guide/GuideShell";

export const metadata: Metadata = {
  title: { template: "%s — BigMarkt Guide", default: "BigMarkt Guide" },
  description: "How to use BigMarkt — verified trade journaling and social trading.",
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return <GuideShell>{children}</GuideShell>;
}
