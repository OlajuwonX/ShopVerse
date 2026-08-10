import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffProfile } from "@/features/staff/queries/profile";
import { adminPath } from "@/server/auth/admin-route";
import { getCurrentStaffActor } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

type AdminWorkspaceLayoutProps = {
  children: ReactNode;
};

/**
 * Authentication boundary for every backoffice page.
 *
 * A missing or non-staff session is sent to the sign-in page rather than a 404.
 * That reveals nothing: the visitor already holds the configured entry segment,
 * without which neither page is reachable, and no `next`/`callback` parameter is
 * carried so there is no open-redirect surface (SEC-19).
 *
 * The actor is resolved once here and passed down. Individual pages and every
 * mutation still perform their own `requirePermission` check — this layout is
 * not the enforcement point for anything beyond "is an active staff member".
 */
export default async function AdminWorkspaceLayout({
  children,
}: AdminWorkspaceLayoutProps) {
  const actor = await getCurrentStaffActor();

  if (!actor) {
    redirect(adminPath("login"));
  }

  const profile = await getStaffProfile(actor.staffAccountId);

  return (
    <AdminShell
      adminRoot={adminPath()}
      permissions={[...actor.permissions]}
      profile={profile}
    >
      {children}
    </AdminShell>
  );
}
