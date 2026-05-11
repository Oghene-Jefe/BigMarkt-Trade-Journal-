type Badge = 'manual' | 'auto_verified' | 'draft' | 'edited' | 'prop_firm'

const BADGE_CONFIG: Record<Badge, { label: string; colour: string; dot: string }> = {
  auto_verified: { label: 'AUTO-VERIFIED', colour: 'text-blue-400',   dot: '🔵' },
  manual:        { label: 'MANUAL',        colour: 'text-yellow-400', dot: '🟡' },
  draft:         { label: 'DRAFT',         colour: 'text-gray-400',   dot: '⚪' },
  edited:        { label: 'EDITED',        colour: 'text-red-400',    dot: '🔴' },
  prop_firm:     { label: 'PROP FIRM',     colour: 'text-orange-400', dot: '🟠' },
}

export default function TrustBadge({ badge }: { badge: Badge }) {
  const config = BADGE_CONFIG[badge] ?? BADGE_CONFIG.manual
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono font-semibold ${config.colour}`}>
      <span aria-hidden="true">{config.dot}</span>
      <span>{config.label}</span>
    </span>
  )
}
