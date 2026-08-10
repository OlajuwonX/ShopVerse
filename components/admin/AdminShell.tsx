import type { ReactNode } from "react";

import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { AdminNav } from "@/components/admin/AdminNav";
import { Button } from "@/components/ui/Button";
import type { Permission } from "@/constants/permissions";
import { signOutStaff } from "@/features/authentication/actions/staff-session";
import type { StaffProfile } from "@/features/staff/queries/profile";

type AdminShellProps = {
  adminRoot: string;
  children: ReactNode;
  permissions: readonly Permission[];
  profile: StaffProfile | null;
};

export function AdminShell({
  adminRoot,
  children,
  permissions,
  profile,
}: AdminShellProps) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-header border-b border-border bg-surface-raised">
        <div className="flex items-center gap-3 px-(--page-gutter) py-3">
          <AdminMobileNav adminRoot={adminRoot} permissions={permissions} />

          <div className="flex min-w-0 flex-col">
            <span className="text-label font-bold text-text">ShopVerse</span>
            <span className="text-caption text-text-muted">Backoffice</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {profile ? (
              <div className="hidden min-w-0 text-right sm:block">
                <p className="truncate text-body-sm font-semibold text-text">
                  {profile.name ?? profile.email}
                </p>
                <p className="truncate text-caption text-text-muted">
                  {profile.title ?? profile.roleName}
                </p>
              </div>
            ) : null}

            <form action={signOutStaff}>
              <Button size="sm" type="submit" variant="secondary">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-(--page-max) gap-8 px-(--page-gutter) py-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-24">
            <AdminNav adminRoot={adminRoot} permissions={permissions} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
