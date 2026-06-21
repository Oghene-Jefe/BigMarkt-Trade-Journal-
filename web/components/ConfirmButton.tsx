"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Inline branded confirmation. Drop-in replacement for the previous
// native-confirm version: same props (children, message, className) plus an
// optional confirmLabel. Must be used inside a <form action={serverAction}>
// — the confirm button submits that form.
//
// The confirmation panel is rendered with `position: fixed`, anchored to the
// trigger via getBoundingClientRect and flipped above/below based on available
// viewport space. Fixed positioning keeps it OUT of any clipping ancestor (the
// journal table sits in an `overflow-x-auto` scroller that would otherwise hide
// a panel dropping below the row) while staying inside the <form> DOM, so the
// type="submit" button still submits the action.
const PANEL_W = 256;
const PANEL_H = 132;
const GAP = 8;

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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const top =
      spaceBelow < PANEL_H + GAP ? r.top - PANEL_H - GAP : r.bottom + GAP;
    const left = Math.max(
      GAP,
      Math.min(r.right - PANEL_W, window.innerWidth - PANEL_W - GAP),
    );
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        btnRef.current?.contains(t) ||
        panelRef.current?.contains(t)
      )
        return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Reposition on scroll/resize so the panel tracks its trigger.
    const onMove = () => place();
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, place]);

  return (
    <span className="inline-block">
      <button
        ref={btnRef}
        type="button"
        className={className}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {children}
      </button>

      {open && pos && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: PANEL_W }}
          className="z-50 rounded-lg border border-loss/40 bg-panel p-3 shadow-xl"
        >
          <p className="text-xs text-white/80">{message}</p>
          <p className="mt-1 text-xs font-semibold text-loss">Are you sure?</p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-loss px-3 py-1.5 text-xs font-semibold text-white hover:bg-loss/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loss/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
