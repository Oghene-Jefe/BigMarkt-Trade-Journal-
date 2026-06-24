export type Badge = "manual" | "auto_verified" | "draft" | "edited" | "prop_firm" | "demo";

const BADGE_CONFIG: Record<Badge, { label: string; colour: string; dotClass: string }> = {
  auto_verified: { label: "Auto-verified", colour: "text-blue-400", dotClass: "bg-blue-400" },
  manual: { label: "Manual", colour: "text-yellow-400", dotClass: "bg-yellow-400" },
  draft: { label: "Draft", colour: "text-gray-400", dotClass: "bg-gray-400" },
  edited: { label: "Edited", colour: "text-red-400", dotClass: "bg-red-400" },
  prop_firm: { label: "Prop firm", colour: "text-orange-400", dotClass: "bg-orange-400" },
  demo: { label: "Demo", colour: "text-purple-400", dotClass: "bg-purple-400" },
};

export default function TrustBadge({ badge }: { badge: Badge }) {
  const config = BADGE_CONFIG[badge] ?? BADGE_CONFIG.manual;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.colour}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
      <span>{config.label}</span>
    </span>
  );
}
