"use client";

export default function ShareableLink({ url }: { url: string }) {
  return (
    <input
      readOnly
      value={url}
      onClick={(e) => e.currentTarget.select()}
      className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm font-mono"
    />
  );
}
