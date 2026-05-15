import Image from "next/image"

interface LogoProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizes = {
  sm:  { width: 80,  height: 24 },
  md:  { width: 120, height: 36 },
  lg:  { width: 160, height: 48 },
}

export default function Logo({ size = "md", className }: LogoProps) {
  const { width, height } = sizes[size]
  return (
    <Image
      src="/images/bigmarkt-logo.png"
      alt="BigMarkt"
      width={width}
      height={height}
      priority
      className={className}
    />
  )
}
