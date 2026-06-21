import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

const inputClass =
  "w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm focus:border-gold/50 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

type FieldProps = {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
};

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-loss">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

type InputProps = Omit<ComponentPropsWithoutRef<"input">, "className"> & {
  className?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ className = "", ...rest }, ref) {
    return <input ref={ref} className={`${inputClass} ${className}`} {...rest} />;
  },
);

type SelectProps = Omit<ComponentPropsWithoutRef<"select">, "className"> & {
  className?: string;
};

export function Select({ className = "", children, ...rest }: SelectProps) {
  return (
    <select className={`${inputClass} ${className}`} {...rest}>
      {children}
    </select>
  );
}
