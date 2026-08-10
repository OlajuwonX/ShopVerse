import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isAdminRouteSegment } from "@/server/auth/admin-route";

/**
 * The backoffice must never be cached or indexed (CACHE-01, MASTER §58, §79).
 */
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

/**
 * Validates the externally configured entry segment and nothing else.
 *
 * Obscurity is not authorization (MASTER §39, §77) — this check exists so the
 * backoffice is not casually discoverable, and it deliberately runs before any
 * database work so that arbitrary unmatched URLs cannot be used to generate
 * session lookups. Authentication and RBAC live in the nested workspace layout.
 */
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
