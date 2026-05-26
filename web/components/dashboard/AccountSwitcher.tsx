"use client";

type AccountType = "live" | "demo" | "prop_firm";

export type SwitcherAccount = {
  id: string;
  account_name: string; // maps to label
  broker_name: string;  // maps to broker_slug display
  account_type: AccountType;
};

type Props = {
  accounts: SwitcherAccount[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const BADGE: Record<AccountType, { label: string; className: string }> = {
  live: { label: "LIVE", className: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" },
  demo: { label: "DEMO", className: "bg-amber-500/20 text-amber-300 border border-amber-500/30" },
  prop_firm: { label: "PROP", className: "bg-purple-500/20 text-purple-300 border border-purple-500/30" },
};

export default function AccountSwitcher({ accounts, selectedId, onSelect }: Props) {
  if (accounts.length === 0) return null;

  const single = accounts.length === 1;

  return (
    <div className="flex flex-wrap gap-2">
      {accounts.map((acc) => {
        const badge = BADGE[acc.account_type];
        const isSelected = acc.id === selectedId;

        if (single) {
          return (
            <div
              key={acc.id}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-panel/60 px-3 py-1.5 text-sm"
            >
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                {badge.label}
              </span>
              <span className="font-medium text-white">{acc.account_name}</span>
              <span className="text-xs text-muted">{acc.broker_name}</span>
            </div>
          );
        }

        return (
          <button
            key={acc.id}
            type="button"
            onClick={() => onSelect(acc.id)}
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
              isSelected
                ? "border-gold/50 bg-gold/10 text-white"
                : "border-white/10 bg-panel/40 text-muted hover:border-white/20 hover:text-white"
            }`}
          >
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.className}`}>
              {badge.label}
            </span>
            <span className="font-medium">{acc.account_name}</span>
            <span className="text-xs opacity-70">{acc.broker_name}</span>
          </button>
        );
      })}
    </div>
  );
}
