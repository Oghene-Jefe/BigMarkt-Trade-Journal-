import type { ReactNode } from "react";

export function GuideTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-2xl font-semibold text-white sm:text-3xl">{children}</h1>;
}

export function GuideLead({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-sm text-muted">{children}</p>;
}

export function GuideH2({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 mb-3 text-lg font-medium text-white">{children}</h2>;
}

export function GuideCallout({
  tone = "tip",
  children,
}: {
  tone?: "tip" | "warning" | "lock";
  children: ReactNode;
}) {
  const styles = {
    tip: "border-gold/30 bg-gold/5 text-gold/90",
    warning: "border-loss/40 bg-loss/10 text-loss",
    lock: "border-white/15 bg-white/5 text-muted",
  }[tone];
  return (
    <div className={`mt-4 rounded-md border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export function GuideSteps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="mt-3 space-y-2 text-sm text-white/80">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-[10px] font-medium text-muted">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

export function GuideTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-white/10">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-medium text-white">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-white/80 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GuideRelated({ links }: { links: { href: string; label: string }[] }) {
  return (
    <div className="mt-10 border-t border-white/10 pt-4">
      <p className="mb-2 text-xs uppercase tracking-wider text-muted">Related</p>
      <div className="flex flex-wrap gap-3">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="text-sm text-gold hover:underline"
          >
            {l.label} &rarr;
          </a>
        ))}
      </div>
    </div>
  );
}

export function GuideNext({ href, label }: { href: string; label: string }) {
  return (
    <div className="mt-8">
      <a
        href={href}
        className="inline-flex items-center gap-1.5 rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold/90"
      >
        {label} &rarr;
      </a>
    </div>
  );
}
