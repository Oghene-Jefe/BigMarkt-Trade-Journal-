# UI primitives

Shared building blocks for BigMarkt app surfaces. Import from `@/components/ui`.

## Rules

- **Radius**: `rounded-md` for inputs/buttons/pills, `rounded-lg` for sections/cards. No `rounded-2xl`.
- **Case**: sentence case for headings, titles, and button labels. ALL CAPS reserved for small technical labels (metric labels, timestamps).
- **Icons**: `lucide-react` only. No emoji in operational UI. Pass via the `icon` prop.
- **Color**: gold is reserved for primary action + the BIGMARKT wordmark. Status colors go through `StatusPill` (`ok` / `warn` / `error` / `info` / `neutral`).
- **Density**: prefer `Section` over freestanding panels. Avoid panel-on-panel nesting.

## Components

| Component | Use for |
|---|---|
| `Button`, `LinkButton` | Any clickable action. Variants: `primary`, `secondary`, `ghost`, `danger`. |
| `Field`, `Input`, `Select` | Form fields with label + hint/error. |
| `StatusPill` | Inline status indicators (sync state, account mode, key permissions). |
| `EmptyState` | "Nothing here yet" surfaces. Always include one primary CTA. |
| `PageHeader` | Top of every page. Replaces ad-hoc `font-display tracking-widest` headers. |
| `MetricCard` | Numeric KPI tiles (dashboard, analytics). |
| `Section` | Grouped content with optional header + action row. |
| `ActionBar` | Right-aligned form/page action row. |
