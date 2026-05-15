import Link from "next/link";
import type { Route } from "next";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-gold text-black hover:bg-gold/90",
  secondary: "border border-white/15 text-white hover:bg-white/5",
  ghost: "text-muted hover:text-white hover:bg-white/5",
  danger: "border border-loss/40 text-loss hover:bg-loss/10",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

type ButtonProps = CommonProps &
  Omit<ComponentPropsWithoutRef<"button">, "className" | "children">;

export function Button({
  variant = "primary",
  size = "md",
  icon,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

type LinkButtonProps = CommonProps & {
  href: Route;
};

export function LinkButton({
  variant = "primary",
  size = "md",
  icon,
  children,
  className = "",
  href,
}: LinkButtonProps) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}
