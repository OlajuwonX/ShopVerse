import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isAdminRouteSegment } from "@/server/auth/admin-route";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  title: {
    absolute: "Backoffice",
  },
};

export default async function AdminEntryLayout({
  children,
  params,
}: LayoutProps<"/[adminEntry]">) {
  const { adminEntry } = await params;

  if (!isAdminRouteSegment(adminEntry)) {
    notFound();
  }

  return children;
}
