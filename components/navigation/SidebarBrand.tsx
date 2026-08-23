import Image from "next/image";
import Link from "next/link";

import shopverseMark from "@/public/logo/shopverse-mark.webp";

export function SidebarBrand() {
  return (
    <Link
      className="flex items-center gap-2 rounded-md px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      href="/"
    >
      <Image
        alt=""
        className="size-8 shrink-0"
        height={32}
        priority
        src={shopverseMark}
        width={32}
      />
      <span className="text-heading-3 font-bold tracking-tight text-text">
        ShopVerse
      </span>
    </Link>
  );
}
