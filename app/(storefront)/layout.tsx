import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import shopverseMark from "@/public/logo/shopverse-mark.webp";

import { Toaster } from "@/components/feedback/Toaster";
import { DirectionalHeader } from "@/components/navigation/DirectionalHeader";
import { HeaderActions } from "@/components/navigation/HeaderActions";
import { SidebarBrand } from "@/components/navigation/SidebarBrand";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/navigation/SkipLink";
import { StorefrontMenu } from "@/components/navigation/StorefrontMenu";
import { SearchInput } from "@/components/ui/SearchInput";
import { APP_SCROLL_ID } from "@/hooks/useDirectionalHeader";

type StorefrontLayoutProps = {
  children: ReactNode;
  sidebar: ReactNode;
};

export default function StorefrontLayout({ children, sidebar }: StorefrontLayoutProps) {
  return (
    <div className="min-h-screen bg-surface lg:flex lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <SkipLink />
      <Toaster />

      <aside className="hidden w-72 shrink-0 border-r border-border lg:flex lg:h-screen lg:flex-col">
        <div className="shrink-0 border-b border-border bg-surface px-3 py-4">
          <SidebarBrand />
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-6"
          id="sidebar-scroll"
        >
          {sidebar}
        </div>
      </aside>

      <div
        className="flex min-w-0 flex-1 flex-col lg:h-screen lg:overflow-y-auto lg:overscroll-contain"
        id={APP_SCROLL_ID}
      >
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
