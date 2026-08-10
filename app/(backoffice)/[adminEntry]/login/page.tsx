import { redirect } from "next/navigation";

import { StaffLoginForm } from "@/app/(backoffice)/[adminEntry]/login/StaffLoginForm";
import { Card } from "@/components/ui/Card";
import { adminPath } from "@/server/auth/admin-route";
import { requireStaffSession } from "@/server/auth/sessions";

export const dynamic = "force-dynamic";

/**
 * Reachable only with the configured entry segment, which the parent layout has
 * already validated. The page states nothing about the store, the staff
 * directory, or why a previous attempt failed.
 */
export default async function StaffLoginPage() {
  const existingSession = await requireStaffSession();

  if (existingSession) {
    redirect(adminPath());
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-(--page-gutter) py-12">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 grid gap-1">
          <h1 className="text-heading-3 font-bold text-text">ShopVerse Backoffice</h1>
          <p className="text-body-sm text-text-muted">
            Staff sign-in. Access is granted by role, not by knowing this address.
          </p>
        </div>

        <StaffLoginForm />
      </Card>
    </main>
  );
}
