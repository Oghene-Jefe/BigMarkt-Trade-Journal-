import type { Metadata } from "next";

// Auth pages (login/signup/reset) are "use client" and can't export
// metadata themselves. This route-group layout keeps them out of search
// indexes — there's nothing to rank here, and indexing risks duplicate
// or thin-content signals.
export const metadata: Metadata = {
  robots: { index: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
