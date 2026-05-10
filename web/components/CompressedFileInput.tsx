"use client";

// Client-side image compression for chart uploads. Mirrors the canvas
// downscale-and-quality pattern from the old static app's trades.js.
// On change: read the chosen file, draw to a max-1600px canvas, re-encode
// at 0.82 quality, and stuff the result back into the input via DataTransfer.
// The form's existing server action picks up the smaller file as if the
// user had selected it directly.

import { useState } from "react";

const MAX_DIM = 1600;
const QUALITY = 0.82;

type Props = {
  name: string;
  accept?: string;
  className?: string;
};

export default function CompressedFileInput({ name, accept, className }: Props) {
  const [hint, setHint] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <input
        type="file"
        name={name}
        accept={accept}
        className={className}
        onChange={async (e) => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          if (!file || !file.type.startsWith("image/")) return;
          setHint(`compressing ${(file.size / 1024).toFixed(0)} KB…`);
          try {
            const compressed = await compressImage(file);
            const dt = new DataTransfer();
            dt.items.add(compressed);
            input.files = dt.files;
            const before = (file.size / 1024).toFixed(0);
            const after = (compressed.size / 1024).toFixed(0);
            setHint(`${before} KB → ${after} KB · will upload`);
          } catch {
            setHint("could not compress; original file will be uploaded");
          }
        }}
      />
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

async function compressImage(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const outType = "image/jpeg"; // jpeg compresses photos best; alpha rare for charts
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      outType,
      QUALITY,
    );
  });

  // Keep size: only swap if compression actually saved bytes.
  if (blob.size >= file.size) return file;
  const ext = "jpg";
  const base = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${base}.${ext}`, { type: outType, lastModified: Date.now() });
}
