import type { ReactNode } from "react";

type Props = {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Section({ title, action, children, className = "" }: Props) {
  return (
    <section className={`rounded-lg border border-white/10 bg-panel/60 ${className}`}>
      {title || action ? (
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          {title ? <h2 className="text-sm font-medium text-white">{title}</h2> : <span />}
          {action ? <div>{action}</div> : null}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}
