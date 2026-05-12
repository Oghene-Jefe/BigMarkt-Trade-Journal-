"use client";

import { useEffect, useRef, useState } from "react";

// Inline branded confirmation. Drop-in replacement for the previous
// native-confirm version: same props (children, message, className) plus an
// optional confirmLabel. Must be used inside a <form action={serverAction}>
// — the confirm button submits that form.
export default function ConfirmButton({
  children,
  message,
  className,
  confirmLabel = "Yes, delete",
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
  confirmLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        className={className}
        onClick={() => setOpen((v) => !v)}
      >
        {children}
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-64 rounded-md border border-amber-400/30 bg-gray-900 p-3 shadow-lg"
          role="dialog"
        >
          <p className="text-xs text-white/80">{message}</p>
          <p className="mt-1 text-xs font-medium text-amber-400">
            Are you sure?
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md border border-rose-500/30 bg-rose-500/20 px-3 py-1 text-xs font-medium text-rose-200 hover:bg-rose-500/30"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
