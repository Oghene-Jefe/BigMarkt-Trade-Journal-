import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, description, icon, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-panel/40 px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-muted">{icon}</div> : null}
      <h3 className="text-base font-medium text-white">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
