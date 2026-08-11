import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PermissionGuard } from "@/components/ui/PermissionGuard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { permissions as allPermissions } from "@/constants/permissions";
import { getStaffProfile } from "@/features/staff/queries/profile";
import { guardStaffActor } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const actor = await guardStaffActor();
  const profile = await getStaffProfile(actor.staffAccountId);

  const granted = allPermissions.filter((permission) =>
    actor.permissions.has(permission),
  );

  return (
    <div className="grid gap-6">
      <SectionHeader
        eyebrow="Overview"
        title={`Welcome back, ${profile?.name ?? profile?.email ?? "there"}`}
      />

      <Card className="grid gap-4 p-6">
        <div className="grid gap-1">
          <h3 className="text-label font-semibold text-text">Your access</h3>
          <p className="text-body-sm text-text-muted">
            Resolved from the database on every request. Role and permission changes
            take effect on your next page load.
          </p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <dt className="text-caption font-semibold text-text-subtle uppercase">
              Role
            </dt>
            <dd className="text-body-sm text-text">{profile?.roleName ?? "Unknown"}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-caption font-semibold text-text-subtle uppercase">
              Permissions
            </dt>
            <dd className="text-body-sm text-text">
              {granted.length} of {allPermissions.length}
            </dd>
          </div>
        </dl>

        <ul className="flex flex-wrap gap-2">
          {granted.map((permission) => (
            <li key={permission}>
              <Badge tone="brand">{permission}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <PermissionGuard actor={actor} permissions={["analytics.read"]}>
        <Card className="grid gap-2 p-6">
          <h3 className="text-label font-semibold text-text">Commerce metrics</h3>
          <p className="text-body-sm text-text-muted">
            Revenue, orders, customers and average order value arrive with the analytics
            dashboard. This card is visible because you hold{" "}
            <code className="text-caption">analytics.read</code>.
          </p>
        </Card>
      </PermissionGuard>
    </div>
  );
}
