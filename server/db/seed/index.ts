import { seedRbac } from "@/server/db/seed/rbac";

async function main() {
  const result = await seedRbac();

  console.info("rbac seed complete", result);

  if (result.superAdmin === "skipped") {
    console.info(
      "super admin bootstrap skipped — set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD to create the first staff account",
    );
  }
}

main().catch((error: unknown) => {
  console.error("rbac seed failed", error);
  process.exitCode = 1;
});
