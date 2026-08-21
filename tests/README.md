# ShopVerse tests

Test layers per `MASTER.md` §86 and `.claude/primitives/33-testing.md`.

```text
tests/
├── unit/          pure logic — no network, no database
├── integration/   real Neon database, no mocks for data access
├── setup/         env loading shared by every run
└── stubs/         module stubs (server-only)
```

## Running

```bash
pnpm test              # everything
pnpm test:unit         # fast, hermetic
pnpm test:integration  # requires DATABASE_URL and a seeded database
pnpm test:watch
```

Integration tests read `DATABASE_URL` from `.env`. If it is absent, `tests/setup/env.ts`
substitutes a placeholder and every integration suite **skips** rather than failing, so
unit tests stay runnable anywhere. Run `pnpm db:seed` before the integration suite.

## What each layer covers

| Layer       | File                          | Covers                                                                                            |
| ----------- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| unit        | `money.test.ts`               | integer kobo conversion, floored discounts (`DATA-01`)                                            |
| unit        | `slug.test.ts`                | slug generation, deterministic disambiguation (`DATA-03`, `DATA-07`)                              |
| unit        | `catalogue-query.test.ts`     | query schema bounds, cursor forgery, cache-key canonicalisation (`SRCH-04`, `SRCH-08`, `SRCH-10`) |
| unit        | `pricing.test.ts`             | variant price resolution, price-range clamping (`SRCH-06`, `SRCH-07`)                             |
| unit        | `permissions.test.ts`         | permission checks and the escalation guard (`SEC-15`)                                             |
| unit        | `cache-tags.test.ts`          | tag construction and targeted invalidation (`CACHE-02`, `CACHE-03`)                               |
| unit        | `storefront-sections.test.ts` | section config parsing, rule compilation (`SEC-11`)                                               |
| unit        | `media.test.ts`               | Cloudinary URL building, upload validation (`SEC-08`–`SEC-10`, `MEDIA-01`, `MEDIA-05`)            |
| unit        | `auth-primitives.test.ts`     | opaque tokens, admin-route concealment, honeypot (`SEC-03`, `SEC-18`)                             |
| unit        | `design-tokens.test.ts`       | every semantic utility used in source resolves to a declared token                                |
| integration | `catalogue.test.ts`           | listing, filters, sorts, cursor walk, injection safety (`SRCH-09`)                                |
| integration | `categories.test.ts`          | tree, ancestors, descendants, attribute inheritance, cycle guard (`DATA-04`)                      |
| integration | `storefront-sections.test.ts` | section scheduling windows (`ADM-05`), data sources                                               |
| integration | `sessions.test.ts`            | session issue, expiry, idle timeout, revocation, audience separation                              |
| integration | `rbac.test.ts`                | database-resolved permissions, least privilege (`SEC-02`)                                         |
| integration | `seed-idempotency.test.ts`    | re-running the seed does not duplicate rows (`DATA-07`)                                           |

## Rules these tests follow

- A test must fail when the behaviour is removed. `design-tokens.test.ts` was verified by
  reintroducing the Stage 04 z-index bug: 5 of its 7 assertions fail.
- Integration tests use the real database. Mocking data access would hide the bugs this
  project cares about. `next/headers` and `next/cache` are stubbed where a test needs a
  request or cache context that only the framework provides — the database never is.
- Fixtures are created and removed by the test that needs them. Section fixtures use the
  `vitest-fixture-` slug prefix and are deleted in `afterEach`; session rows are deleted by
  id; the staff-status test restores the account it disabled.
- Money is asserted in integer minor units.

## Not covered yet

E2E (Playwright) per `MASTER.md` §86, and the concurrency and idempotency tests required by
primitive 33 §"Concurrency and idempotency tests are mandatory" — those need the checkout,
payment and inventory code that arrives in Stages 27–30.

## E2E and accessibility (Playwright)

```bash
pnpm test:e2e          # both projects
pnpm test:e2e:ui       # interactive runner
```

Playwright starts its own production server on port 3100, so it never collides with a
`pnpm start` on 3000. Two projects run every spec: `desktop` (1440x900) and `mobile`
(390x844).

| File                                 | Covers                                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/accessibility.spec.ts`          | axe-core scan (WCAG 2.0/2.1 A + AA) on six surfaces, landmark and heading structure, unique landmark names, skip link                                                                 |
| `e2e/search-combobox.spec.ts`        | combobox ARIA, listbox, `aria-activedescendant`, arrow-key wrap, Escape, Enter, debounce request counting, recent-search persistence                                                  |
| `e2e/navigation-and-filters.spec.ts` | persistent sidebar per breakpoint and per route, active-branch marking, mobile sheet focus trap and scroll lock, live-region count, filter/chip/clear URL behaviour, slider semantics |

### What this does and does not prove

It runs a **real browser** and asserts against the **accessibility tree** — the same tree a
screen reader consumes — plus automated axe rules. That covers roles, accessible names,
`aria-activedescendant`, focus movement and contrast.

It is **not** a human screen-reader pass. Announcement quality, verbosity and reading order
in NVDA/JAWS/VoiceOver remain unverified.
