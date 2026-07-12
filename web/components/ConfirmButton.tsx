"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

// Inline branded confirmation. Drop-in: same props (children, message,
// className, confirmLabel). Must be used inside a <form action={serverAction}>
// — the confirm button submits that form. Renders a centered dialog with a
// black backdrop (matches the app's modals); fixed inset-0 escapes any
// overflow-clipping ancestor (e.g. the journal table's horizontal scroller)
// while staying in the <form> DOM so type="submit" still submits the action.
export default function ConfirmButton({
  children,
  message,
  className,
  confirmLabel = "Delete",
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
  confirmLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <span className="inline-block">
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-lg border border-white/10 bg-panel p-5 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-loss" aria-hidden />
              <div>
                <p className="text-sm text-white/90">{message}</p>
                <p className="mt-1 text-xs font-semibold text-loss">Are you sure?</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-loss px-4 py-2 text-xs font-semibold text-white hover:bg-loss/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loss/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
