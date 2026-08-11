import { seedCatalogue } from "@/server/db/seed/catalogue";
import { seedRbac } from "@/server/db/seed/rbac";

/**
 * RBAC first: the catalogue seed does not depend on it, but a run that fails
 * halfway is more useful if the backoffice is already reachable.
 */
async function main() {
  const rbac = await seedRbac();

  console.info("rbac seed complete", rbac);

  if (rbac.superAdmin === "skipped") {
    console.info(
      "super admin bootstrap skipped — set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD to create the first staff account",
    );
  }

  const catalogue = await seedCatalogue();

  console.info("catalogue seed complete", catalogue);
  console.info(
    "no product images were seeded — products render the CloudinaryImage placeholder until real assets are uploaded",
  );
}

main().catch((error: unknown) => {
  console.error("seed failed", error);
  process.exitCode = 1;
});
