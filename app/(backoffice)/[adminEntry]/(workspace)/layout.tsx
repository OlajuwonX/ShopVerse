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
