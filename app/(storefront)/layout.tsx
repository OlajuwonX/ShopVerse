import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import shopverseMark from "@/public/logo/shopverse-mark.webp";

import { DirectionalHeader } from "@/components/navigation/DirectionalHeader";
import { HeaderActions } from "@/components/navigation/HeaderActions";
import { PrimaryNav } from "@/components/navigation/PrimaryNav";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/navigation/SkipLink";
import { StorefrontMenu } from "@/components/navigation/StorefrontMenu";
import { SearchInput } from "@/components/ui/SearchInput";

type StorefrontLayoutProps = {
  children: ReactNode;
};

export default function StorefrontLayout({ children }: StorefrontLayoutProps) {
  return (
    <div className="min-h-screen bg-surface">
      <SkipLink />

      <DirectionalHeader>
        <div className="mx-auto flex w-full max-w-(--page-max) flex-wrap items-center gap-2 px-(--page-gutter) py-2 md:gap-4 md:py-3">
          <StorefrontMenu />

          <Link
            className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            href="/"
          >
            <Image
              alt=""
              className="size-9 shrink-0"
              height={36}
              priority
              src={shopverseMark}
              width={36}
            />
            <span className="text-heading-3 font-bold tracking-tight text-text">
              ShopVerse
            </span>
          </Link>

          <SearchInput className="order-last w-full md:order-none md:mx-2 md:max-w-2xl md:flex-1" />

          <HeaderActions className="ml-auto md:ml-0" />
        </div>

        <div className="border-t border-border group-data-[state=compact]:hidden">
          <div className="mx-auto w-full max-w-(--page-max) px-(--page-gutter)">
            <PrimaryNav />
          </div>
        </div>
      </DirectionalHeader>

      <main id={MAIN_CONTENT_ID}>{children}</main>
    </div>
  );
}
