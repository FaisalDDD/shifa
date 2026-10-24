import Link from "next/link";
import Image from "next/image";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center" aria-label="Shifa home">
      <Image
        src="/shifa-logo.png"
        alt="Shifa"
        width={88}
        height={96}
        className="h-9 w-auto"
        priority
      />
    </Link>
  );
}
