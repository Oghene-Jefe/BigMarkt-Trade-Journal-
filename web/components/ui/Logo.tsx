import Image from "next/image";

type Size = "sm" | "md" | "lg" | "xl";

const DIMENSIONS: Record<Size, { width: number; height: number }> = {
  sm: { width: 80, height: 24 },
  md: { width: 120, height: 36 },
  lg: { width: 160, height: 48 },
  xl: { width: 220, height: 66 },
};

type Props = {
  size?: Size;
  className?: string;
};

export default function Logo({ size = "md", className }: Props) {
  const { width, height } = DIMENSIONS[size];
  return (
    <Image
      src="/images/bigmarkt-logo.png"
      alt="BigMarkt"
      width={width}
      height={height}
      priority
      className={className}
    />
  );
}
