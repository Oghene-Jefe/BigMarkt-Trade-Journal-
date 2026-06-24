type AvatarSize = "sm" | "md" | "card" | "lg";

const SIZE: Record<AvatarSize, { outer: string; text: string }> = {
  sm:   { outer: "h-8 w-8",   text: "text-xs" },
  md:   { outer: "h-10 w-10", text: "text-sm" },
  card: { outer: "h-12 w-12", text: "text-sm" },
  lg:   { outer: "h-20 w-20", text: "text-2xl" },
};

function initial(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function Avatar({
  url,
  name,
  size = "md",
  ringClass = "border border-white/10",
}: {
  url?: string | null;
  name?: string | null;
  size?: AvatarSize;
  ringClass?: string;
}) {
  const s = SIZE[size];
  return (
    <div className={`${s.outer} shrink-0 overflow-hidden rounded-full bg-black/40 ${ringClass}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span
          className={`flex h-full w-full items-center justify-center bg-gold/20 font-semibold text-gold ${s.text}`}
        >
          {initial(name)}
        </span>
      )}
    </div>
  );
}
