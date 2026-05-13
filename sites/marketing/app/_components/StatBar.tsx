type PlatformStats = {
  total_traders?: number;
  auto_verified_trades?: number;
  public_leaders?: number;
};

async function fetchStats(): Promise<PlatformStats | null> {
  try {
    const res = await fetch(
      "https://journal.bigmarkt.co/api/public/platform-stats",
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    return (await res.json()) as PlatformStats;
  } catch {
    return null;
  }
}

function fmt(n: number | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US");
}

export default async function StatBar() {
  const stats = await fetchStats();

  const items = [
    { label: "Traders", value: fmt(stats?.total_traders) },
    { label: "Auto-Verified Trades", value: fmt(stats?.auto_verified_trades) },
    { label: "Public Leaders", value: fmt(stats?.public_leaders) },
  ];

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden border border-[#1f1f1f] bg-[#1f1f1f] sm:grid-cols-3">
      {items.map((it) => (
        <div key={it.label} className="bg-[#0a0a0a] px-6 py-6 text-center">
          <div className="font-mono text-3xl font-bold text-[#C9A84C]">{it.value}</div>
          <div className="mt-1 text-xs uppercase tracking-widest text-white/50">{it.label}</div>
        </div>
      ))}
    </div>
  );
}
