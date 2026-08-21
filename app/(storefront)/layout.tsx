import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import shopverseMark from "@/public/logo/shopverse-mark.webp";

import { DirectionalHeader } from "@/components/navigation/DirectionalHeader";
import { HeaderActions } from "@/components/navigation/HeaderActions";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/navigation/SkipLink";
import { StorefrontMenu } from "@/components/navigation/StorefrontMenu";
import { SearchInput } from "@/components/ui/SearchInput";

type StorefrontLayoutProps = {
  children: ReactNode;
  sidebar: ReactNode;
};

export default function StorefrontLayout({ children, sidebar }: StorefrontLayoutProps) {
  return (
    <div className="min-h-screen bg-surface lg:flex lg:items-start">
      <SkipLink />

      <aside className="hidden w-72 shrink-0 lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto border-r border-border px-3 py-6">
          {sidebar}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <DirectionalHeader>
          <div className="mx-auto flex w-full max-w-(--content-max) flex-wrap items-center gap-x-3 gap-y-2 px-(--page-gutter) py-2 md:py-3">
            <StorefrontMenu />

            <Link
              aria-label="ShopVerse home"
              className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden"
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
              <span className="hidden text-heading-3 font-bold tracking-tight text-text sm:inline">
                ShopVerse
              </span>
            </Link>

            <SearchInput className="order-last w-full lg:order-0 lg:max-w-2xl lg:flex-1" />

            <HeaderActions className="ml-auto" />
          </div>
        </DirectionalHeader>

        <main
          className="mx-auto w-full max-w-(--content-max) px-(--page-gutter)"
          id={MAIN_CONTENT_ID}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
