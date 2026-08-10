import { CheckCircle2, Database, LockKeyhole, Rocket, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";

const completedStages = [
  {
    id: "01",
    name: "Migration baseline",
    summary:
      "Preserved the existing app, audited the source prompt, and established local build guidance.",
    area: "Foundation",
  },
  {
    id: "02",
    name: "Next.js foundation",
    summary:
      "Replaced the obsolete Vite shape with a strict Next.js App Router project.",
    area: "Foundation",
  },
  {
    id: "03",
    name: "Core configuration",
    summary:
      "Added TypeScript, Tailwind v4, env validation, security headers, linting, and formatting.",
    area: "Foundation",
  },
  {
    id: "04",
    name: "Design system primitives",
    summary:
      "Created reusable UI tokens and accessible primitives for storefront and admin surfaces.",
    area: "Foundation",
  },
  {
    id: "05",
    name: "Database foundation",
    summary:
      "Integrated Neon-ready Drizzle tooling, schema exports, migrations, and validation scripts.",
    area: "Data model",
  },
  {
    id: "06",
    name: "Commerce catalogue schema",
    summary:
      "Modeled brands, categories, attributes, products, variants, images, and inventory.",
    area: "Data model",
  },
  {
    id: "07",
    name: "Merchandising schema",
    summary: "Added collections, campaigns, offers, and storefront section tables.",
    area: "Data model",
  },
  {
    id: "08",
    name: "Users, staff, roles, permissions",
    summary:
      "Modeled customers, staff accounts, roles, permissions, invitations, tokens, and sessions.",
    area: "Data model",
  },
  {
    id: "09",
    name: "Orders and inventory transactions",
    summary:
      "Added order, payment, reservation, stock movement, and activity audit tables.",
    area: "Data model",
  },
  {
    id: "10",
    name: "Authentication runtime",
    summary:
      "Implemented secure credentials, server sessions, HttpOnly cookies, token hashing, and rate limits.",
    area: "Access control",
  },
  {
    id: "11",
    name: "RBAC enforcement",
    summary:
      "Added server-only permission resolution and guards backed by DB roles and staff overrides.",
    area: "Access control",
  },
] as const;

const pillars = [
  {
    title: "Free-first platform",
    description:
      "The stack stays inside free-friendly Next.js, Neon, Drizzle, Tailwind, and static/serverless deployment paths.",
    icon: Rocket,
  },
  {
    title: "Verified data model",
    description:
      "Commerce, merchandising, auth, orders, payments, and stock movement are represented before UI workflows depend on them.",
    icon: Database,
  },
  {
    title: "Server-side trust boundary",
    description:
      "Authentication and RBAC are resolved on the server from cookies and database state, never from client-supplied roles.",
    icon: ShieldCheck,
  },
] as const;

const groups = ["Foundation", "Data model", "Access control"] as const;

export default function HomePage() {
  const completedCount = completedStages.length;
  const totalStages = 40;
  const progress = Math.round((completedCount / totalStages) * 100);

  return (
    <main className="min-h-screen bg-surface px-(--page-gutter) py-8 text-text">
      <div className="mx-auto grid w-full max-w-(--page-max) gap-8">
        <section className="grid gap-5" aria-labelledby="project-status-title">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">Stage 11 complete</Badge>
            <Badge tone="neutral">Next: protected admin shell</Badge>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_280px] lg:items-end">
            <div className="grid gap-3">
              <h1
                id="project-status-title"
                className="max-w-3xl text-heading-1 font-bold md:text-display"
              >
                SpaceVerse build status
              </h1>
              <p className="max-w-2xl text-body text-text-muted">
                The storefront is still early, but the project foundation is now clean:
                typed, formatted, database-modeled, authenticated, and protected by
                server-side permissions.
              </p>
            </div>
            <Card className="grid gap-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-label font-bold text-text-muted">Progress</span>
                <span className="text-heading-3 font-bold text-text">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-body-sm text-text-muted">
                {completedCount} of {totalStages} planned stages complete.
              </p>
            </Card>
          </div>
        </section>

        <section
          className="grid gap-4 md:grid-cols-3"
          aria-label="Current platform pillars"
        >
          {pillars.map((pillar) => {
            const Icon = pillar.icon;

            return (
              <Card className="grid gap-3 p-5" key={pillar.title}>
                <Icon aria-hidden="true" className="size-5 text-brand" />
                <div className="grid gap-1">
                  <h2 className="text-heading-3 font-bold">{pillar.title}</h2>
                  <p className="text-body-sm text-text-muted">{pillar.description}</p>
                </div>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4" aria-labelledby="completed-stage-title">
          <SectionHeader
            eyebrow="Build log"
            title="Completed stages"
            id="completed-stage-title"
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {groups.map((group) => (
              <Card className="grid content-start gap-4 p-5" key={group}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-heading-3 font-bold">{group}</h2>
                  <Badge tone="brand">
                    {completedStages.filter((stage) => stage.area === group).length}{" "}
                    done
                  </Badge>
                </div>
                <ol className="grid gap-3">
                  {completedStages
                    .filter((stage) => stage.area === group)
                    .map((stage) => (
                      <li className="grid gap-1" key={stage.id}>
                        <div className="flex items-center gap-2">
                          <CheckCircle2
                            aria-hidden="true"
                            className="size-4 text-success"
                          />
                          <p className="text-label font-bold">
                            Stage {stage.id}: {stage.name}
                          </p>
                        </div>
                        <p className="pl-6 text-body-sm text-text-muted">
                          {stage.summary}
                        </p>
                      </li>
                    ))}
                </ol>
              </Card>
            ))}
          </div>
        </section>

        <section
          className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]"
          aria-label="Next stage and verification"
        >
          <Card className="grid gap-3 p-5">
            <LockKeyhole aria-hidden="true" className="size-5 text-brand" />
            <div className="grid gap-1">
              <h2 className="text-heading-3 font-bold">Stage 12 is next</h2>
              <p className="text-body-sm text-text-muted">
                The next practical step is a protected admin shell that consumes the
                server auth and RBAC services already built in Stages 10 and 11.
              </p>
            </div>
          </Card>
          <Card className="grid gap-3 p-5">
            <h2 className="text-heading-3 font-bold">Current verification posture</h2>
            <div className="grid gap-2 text-body-sm text-text-muted sm:grid-cols-2">
              <p>TypeScript strict mode passes.</p>
              <p>ESLint passes.</p>
              <p>Production build passes.</p>
              <p>Prettier format check passes.</p>
              <p>Dependency audit reports no known vulnerabilities.</p>
              <p>Drizzle schema check passes with a placeholder database URL.</p>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
