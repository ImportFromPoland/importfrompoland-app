import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
  showText?: boolean;
  linkToDashboard?: boolean;
}

export function Logo({ 
  width = 200, 
  height = 100, 
  className = "",
  showText = false,
  linkToDashboard = false 
}: LogoProps) {
  const logoContent = (
    <div className={`flex items-center gap-3 ${className}`}>
      <Image
        src="/logo.png"
        alt="ImportFromPoland"
        width={width}
        height={height}
        priority
        className="object-contain"
      />
      {showText && (
        <span className="text-2xl font-bold text-primary">ImportFromPoland</span>
      )}
    </div>
  );

  if (linkToDashboard) {
    return (
      <Link href="/" className="hover:opacity-80 transition-opacity">
        {logoContent}
      </Link>
    );
  }

  return logoContent;
}

