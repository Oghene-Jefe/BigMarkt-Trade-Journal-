import type { ReactNode } from "react";

export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-2">{children}</div>;
}
