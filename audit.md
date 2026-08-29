# ShopVerse — Full Audit (Stages 1–27)

> Adversarial security, race-condition, reliability, accessibility and UI review of the
> state at commit `ae8ad1a` plus the uncommitted Stage 27 test harness.
> **No code was modified during this audit.**

---

## Answers to the two questions you asked directly

### 1. Is the application correctly protected against SQL injection?

**Yes — confirmed, with evidence.**

- `grep` for `sql.raw`, `sql.identifier` and string-concatenated SQL across `server/` and
  `features/` returns **zero matches**.
- Every raw query uses Drizzle's `sql` tagged template, where interpolated values become
  **bound parameters**, not text. The recursive category CTE
  (`server/services/categories.ts:94`) interpolates `${categoryId}` and `${MAX_CATEGORY_DEPTH}`
  as parameters; `${categories}` is a table reference resolved by Drizzle, not user input.
- The riskiest-looking construct — the attribute filter in
  `server/services/products.ts` — builds `sql.join(values.map((v) => sql\`${v.toLowerCase()}\`))`.
Each value is still an individual bound parameter. The same holds for the `ilike`search: the`%…%` wrapper is built in JavaScript and the **whole string** is bound.
- All catalogue inputs are additionally Zod-parsed and bounded before reaching SQL.

**Residual risk: none identified.** This is the strongest area of the codebase.

### 2. "Since we are using CSRF tokens, we are well prevented against XSS attacks"

**This premise is incorrect on two counts, and the distinction matters for a money app.**

**(a) CSRF protection does not mitigate XSS — at all.** They defend against opposite
threats:

|                         | CSRF                                                    | XSS                                                                                                   |
| ----------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Attacker's position     | A _different_ origin forging a request with your cookie | Attacker script running _on your own_ origin                                                          |
| What stops it           | Origin/SameSite checks                                  | Output encoding + CSP                                                                                 |
| Does CSRF defence help? | —                                                       | **No.** Injected script is same-origin, so it passes every Origin check and can read/replay any token |

If XSS ever lands on ShopVerse, the attacker's script inherits the victim's session, passes
`assertSameOrigin()` trivially, and can drive checkout, read the cart, and exfiltrate
anything in `localStorage`.

**(b) The project does not use CSRF tokens.** It uses
`assertSameOrigin()` (`server/security/origin.ts`) — Origin/Referer validation — plus
`sameSite: "lax"` cookies. That is a legitimate CSRF defence and I am not suggesting you
change it. But it should be described accurately, because believing you have token-based
CSRF protection _and_ that it covers XSS leaves two gaps unmanaged.

**Actual XSS posture — assessed independently: good at the output layer, weak in depth.**

- Only one `dangerouslySetInnerHTML` exists (`components/seo/JsonLd.tsx:18`) and it is
  correctly escaped: `<`, `>`, `&`, U+2028 and U+2029 are all neutralised before injection.
- Everything else renders through React, which escapes by default.
- **Verified live:** navigating to `/search?q=<script>alert(1)</script>` renders the heading
  as the literal text `Results for <script>alert(1)</script>`. No execution.
- **But** the Content-Security-Policy has **no `default-src` and no `script-src`**
  (`next.config.ts`), so there is no second layer. See finding **H-3**.

---

## Findings summary

| Severity      | Count | IDs       |
| ------------- | ----- | --------- |
| Critical      | 1     | C-1       |
| High          | 4     | H-1 … H-4 |
| Medium        | 6     | M-1 … M-6 |
| Low           | 5     | L-1 … L-5 |
| Informational | 4     | I-1 … I-4 |

---

## CRITICAL

### C-1 — Inventory reservations are never released; stock leaks permanently and can be exhausted by anyone

- **Severity:** Critical
- **Category:** Security / Reliability / Race Condition
- **Location:** `server/services/inventory.ts` (`expireStaleReservations`,
  `releaseOrderReservations`); consumed by nothing.
- **Issue:** `createPendingOrder` decrements `inventory.available` and creates an
  `inventory_reservations` row with a 30-minute `expiresAt`. **Nothing ever calls the expiry
  sweep or the release function.** A `grep` across `app/`, `components/`, `features/`,
  `server/` and `lib/` finds only the definitions — no route, no cron, no action, no
  scheduler invokes them.
- **Impact:** Every abandoned checkout removes stock from sale **forever**. Because no
  payment step exists yet, _100% of orders created today are abandoned_, so all reserved
  stock is permanently lost. Worse, this is a trivially exploitable inventory
  denial-of-service: an attacker needs no account, no payment method, and no card. They
  submit checkouts and walk away.
- **Evidence:**
  - `server/services/orders.ts` → `reserveLines()` writes the decrement.
  - No caller of `expireStaleReservations` exists (confirmed by repository-wide grep).
  - Measured catalogue: **2,257 sellable units across 108 variants**.
  - Bounds allow **50 lines × 20 units = 1,000 units per checkout**
    (`constants/cart.ts`), and the sustained limit is 30 checkouts / 15 min _per IP_ —
    which is itself bypassable (**H-2**).
  - Empirically observed during this project: a single e2e run left 4 orders holding real
    stock, and repeated runs drained `ikea-markus-office-chair` until I manually restored it.
    That is the exact production failure mode, reproduced accidentally.
- **Reproduction:**
  1. Add items to cart, complete `/checkout`. Note `available` drops.
  2. Close the tab. Wait 31 minutes (past `RESERVATION_MINUTES`).
  3. Query `inventory` — `available` is still reduced, `reserved` still held, reservation
     still `status = 'active'`. It never returns.
  4. Repeat ~3 times with full carts to reserve the entire catalogue.
- **Recommended fix:** Three parts, in order:
  1. **Schedule the sweep.** Add an authenticated internal route (shared-secret header or
     Vercel Cron signature) that calls `expireStaleReservations()`, and run it every 1–5
     minutes. The function is already idempotent, batched and safe to run concurrently.
  2. **Bound the blast radius now.** Reduce `CART_MAX_LINES`/`CART_MAX_LINE_QUANTITY`
     for guests, and add a per-IP _and_ per-email cap on orders created per hour that is
     independent of the spoofable IP (see H-2).
  3. **Consider deferring reservation** until Paystack initialization succeeds (Stage 28),
     so an abandoned form never holds stock in the first place.
- **Confidence:** **Confirmed.** Reproduced in this repository.

---

## HIGH

### H-1 — Rate limiter has a lost-update race; limits are ineffective under concurrency

- **Severity:** High
- **Category:** Security / Race Condition
- **Location:** `server/auth/rate-limit.ts:26-80` (`checkRateLimit`)
- **Issue:** The limiter does `SELECT` → compute `attempts = row.attempts + 1` in JavaScript
  → `UPDATE … SET attempts = <computed>`. This is a textbook read-modify-write race. N
  concurrent requests all read the same `attempts` value and all write the same result, so
  the counter advances by **1 instead of N**.
- **Impact:** Defeats the controls protecting the two most sensitive flows:
  - **Staff login brute-force** (`AUTH_RATE_LIMITS.staffLogin`, 5 attempts) — an attacker
    firing 100 parallel requests registers ~1 attempt, so thousands of password guesses fit
    inside the "5 attempt" budget. This directly negates `SEC-04`.
  - **Checkout flooding** (`CHECKOUT_SUSTAINED_LIMIT`, 30 / 15 min) — amplifies **C-1**.
- **Evidence:** The code path is unconditional; there is no `FOR UPDATE`, no conditional
  `WHERE attempts = <expected>`, and no SQL-side increment. This is precisely the pattern
  `primitives/21-idempotency-concurrency.md` forbids ("Never read stock, then blindly
  subtract"), applied to a counter instead of stock. Notably, the **inventory** code gets
  this right (`WHERE available >= qty`) while the rate limiter does not.
- **Reproduction:** Fire 50 concurrent `signInStaff` submissions with a wrong password for
  one email; observe `rate_limits.attempts` advance by ~1–3, not 50, and that the account is
  never blocked.
- **Recommended fix:** Make the increment atomic in SQL — a single
  `INSERT … ON CONFLICT DO UPDATE SET attempts = rate_limits.attempts + 1, …` and evaluate
  the returned value, so Postgres arbitrates. This mirrors the pattern already used
  correctly in `reserveLines`.
- **Confidence:** **Confirmed** by code inspection.

### H-2 — Client-controlled `X-Forwarded-For` makes every IP-based rate limit bypassable

- **Severity:** High
- **Category:** Security
- **Location:** `server/security/request-context.ts:14-26` (`readClientIp`)
- **Issue:** `readClientIp` returns the **leftmost** value of the `X-Forwarded-For` header,
  which is attacker-supplied. Every rate limit in the app keys on this value: checkout
  (`CHECKOUT_BURST_LIMIT`, `CHECKOUT_SUSTAINED_LIMIT`), catalogue, search, wishlist
  hydration, cart validation and staff-login-by-IP.
- **Impact:** An attacker sets a random `X-Forwarded-For` per request and receives an
  unlimited quota on every rate-limited endpoint. Combined with **C-1**, this turns a
  bounded inventory-exhaustion nuisance into an unbounded one; combined with **H-1** it
  removes the last barrier to staff-credential brute-forcing.
- **Evidence:**
  ```ts
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  ```
  Nothing validates the header's provenance or trims to a trusted proxy count.
- **Reproduction:** `curl -H "X-Forwarded-For: 1.2.3.4" …` against `/api/cart/validate` 40
  times (limit is 30/10s), varying the header each time. No `429` is returned.
- **Recommended fix:** On Vercel, prefer the platform-verified value and ignore the raw
  header — read the rightmost entry appended by your own proxy, or use a trusted-proxy hop
  count. Never trust the leftmost XFF value. For anything money-adjacent, additionally key
  limits on a stable non-IP identifier (session id, email, `checkoutAttemptId`).
- **Confidence:** **Confirmed** by code inspection. _Needs verification_ only for the exact
  Vercel header semantics in your deployment.

### H-3 — Content-Security-Policy provides no XSS mitigation; HSTS absent

- **Severity:** High
- **Category:** Security
- **Location:** `next.config.ts` (`securityHeaders`)
- **Issue:** The CSP sets only `base-uri`, `object-src`, `frame-ancestors`, `img-src` and
  `media-src`. There is **no `default-src`, no `script-src`, no `connect-src`, no
  `style-src`, no `form-action`**. With no `script-src`, script execution is entirely
  unrestricted, so the CSP contributes nothing against XSS. `Strict-Transport-Security` is
  also absent, which `primitives/07-security.md` explicitly requires in production.
- **Impact:** Defence-in-depth is missing on the layer that matters most for a payment app.
  Today's output encoding is good (see the XSS assessment above), but a single future
  mistake — an admin rich-text field, a third-party script, a `dangerouslySetInnerHTML`
  added under time pressure — becomes immediately exploitable with session-stealing and
  checkout-manipulation impact. Missing HSTS leaves a TLS-stripping window.
- **Evidence:** Full policy value read from `next.config.ts`; the five listed directives are
  the complete set. `form-action` absence also means an injected form can post credentials
  off-origin.
- **Recommended fix:** Add `default-src 'self'`, `form-action 'self'`,
  `frame-src 'none'`, and a nonce-based `script-src` (Next 16 supports CSP nonces via
  middleware/proxy). Add `Strict-Transport-Security: max-age=63072000; includeSubDomains;
preload` in production only. Roll out with `Content-Security-Policy-Report-Only` first to
  catch breakage.
- **Confidence:** **Confirmed.**

### H-4 — Price-change acknowledgement is enforced only on the client; the server will bind a customer to a price they never saw

- **Severity:** High (impact realised at Stage 28)
- **Category:** Security / Reliability
- **Location:** `features/checkout/actions/checkout.ts` (`submitCheckout`),
  `server/services/orders.ts` (`priceLines`), vs. `features/cart/useCartValidation.ts`
- **Issue:** `CART-01` requires that a price change "require acknowledgement before
  checkout". That check exists **only in the browser**: `useCartValidation` compares the
  server price against `lastSeenUnitPrice` held in `localStorage` and sets `priceChanged`.
  `submitCheckout` never receives or verifies that value — by deliberate design (`CART-07`,
  never trust client money). `createPendingOrder` then prices authoritatively from the
  database.
- **Impact:** If a price rises between the customer's last cart validation and their
  submission — an admin edit, a campaign ending, a cache expiring — the order is created at
  the **new, higher** total with no acknowledgement and no visible warning. Today nothing is
  charged, so the damage is an incorrect order total. **From Stage 28 onward this is the
  amount charged to the card.** It is a customer-harm and chargeback risk, not an attacker
  win (the reverse — paying a stale lower price — is impossible because server prices win).
- **Evidence:** `submitCheckout` inspects only `unpurchasable` and `QUANTITY_REDUCED` from
  `validateCart`; there is no `PRICE_CHANGED` branch server-side. My own Stage 26 completion
  document records this as an intentional client-side design; the gap is that it was never
  given a server-side counterpart.
- **Reproduction:** Load `/checkout` with an item. In another session change that product's
  `base_price` upward. Submit the checkout. An order is created at the new price with no
  warning shown.
- **Recommended fix:** Send an **acknowledged total** (not a price) with the submission —
  e.g. the `grandTotal` the customer last saw — and have the server compare its freshly
  computed total against it. On mismatch, return `cart_changed` with the old→new figures and
  require a second confirmed submission. This keeps `CART-07` intact (the client value is
  never used as money, only as a consent assertion).
- **Confidence:** **Confirmed** by code inspection.

---

## MEDIUM

### M-1 — Cart validation endpoint discloses exact stock levels to anonymous callers

- **Severity:** Medium
- **Category:** Security
- **Location:** `app/api/cart/validate/route.ts`; `server/services/cart.ts`
  (`availableQuantity` in `ValidatedCartLine`)
- **Issue:** The unauthenticated POST endpoint returns `availableQuantity` — the precise
  remaining stock — for any variant id supplied.
- **Impact:** Competitors can scrape exact inventory and infer sales velocity by polling.
  It also gives an attacker precise targeting information for the **C-1** exhaustion attack
  (knowing exactly how many units to reserve).
- **Evidence:** `availableQuantity: available` is returned per line; the route has no auth
  and only an IP-keyed burst limit (bypassable per **H-2**).
- **Recommended fix:** Return a coarse band rather than an exact count for the public path
  (`in_stock` | `low_stock` | `out_of_stock`, with the numeric value only when it is below
  the display threshold you already use, `<= 5`). Keep exact counts for authenticated admin.
- **Confidence:** **Confirmed.**

### M-2 — `checkoutAttemptId` replay returns order and payment references without proving ownership

- **Severity:** Medium
- **Category:** Security
- **Location:** `server/services/orders.ts` (`findByAttempt`, `createPendingOrder`)
- **Issue:** Submitting a known `checkoutAttemptId` returns the full `OrderSummary` for that
  attempt — including `reference` and **`paymentReference`** — with no check that the caller
  owns it. The id is client-generated and stored in `sessionStorage`.
- **Impact:** Not practically exploitable today: UUIDv4 carries ~122 bits, so guessing is
  infeasible. But the attempt id is effectively a **bearer capability** for an order, and
  from Stage 28 the payment reference is what authorises a Paystack transaction. Any future
  leak — logs, a `Referer`, an error report, or the XSS scenario CSP does not currently
  guard (H-3) — becomes order disclosure and potential payment interference.
- **Evidence:** `findByAttempt` filters solely on `orders.checkoutAttemptId`; no session,
  email or cookie binding.
- **Reproduction:** Capture your own `shopverse:checkout-attempt` value from
  `sessionStorage`, replay it from a different browser with any cart — the response
  discloses the original order's reference and total.
- **Recommended fix:** Bind the attempt to something the requester must also hold — set an
  httpOnly checkout cookie when the attempt is created and require it on replay, or
  incorporate the guest email into the replay lookup. Do not return `paymentReference` on a
  replay unless the binding check passes.
- **Confidence:** **High Confidence** (design weakness; not currently exploitable).

### M-3 — Layouts break under large text settings (WCAG 1.4.4 / 1.4.10)

- **Severity:** Medium
- **Category:** Accessibility
- **Location:** `components/commerce/ProductGrid.tsx` (`GRID_TRACK_CLASS`),
  `components/checkout/DeliveryFields.tsx` (`sm:grid-cols-2`)
- **Issue:** Breakpoints key on **viewport width only**, ignoring text scale. At a 640px
  viewport with a 32px root font (200% text scaling), `sm:` variants still apply, so the
  product grid renders 3 columns and the delivery form 2 columns at ~200–300px each.
  Content no longer fits and the page scrolls horizontally.
- **Impact:** Users who increase text size — a large, non-optional accessibility need — get
  a horizontally scrolling page. This is a WCAG 2.1 AA failure (1.4.4 Resize Text; 1.4.10
  Reflow).
- **Evidence:** Measured in a real browser during this audit:
  ```
  ZOOM200 /                        PAGE-OVERFLOW scrollWidth=755 client=640
  ZOOM200 /checkout                PAGE-OVERFLOW scrollWidth=725 client=640
  ZOOM200 /categories/electronics  PAGE-OVERFLOW scrollWidth=755 client=640
  ```
  `/cart` passed — it is single-column and therefore unaffected.
- **Reproduction:** Open `/` at 640px wide, set `document.documentElement.style.fontSize =
"32px"` (or use browser text-only zoom at 200%). The page overflows horizontally.
- **Recommended fix:** Drive the grid from available space rather than viewport width —
  `grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr))` scales with `rem` and so
  respects text size — or adopt container queries. Allow price rows to wrap rather than
  forcing a single line.
- **Confidence:** **Confirmed.** Measured.

### M-4 — In-memory burst limiter is per-instance and near-useless on serverless

- **Severity:** Medium
- **Category:** Security / Reliability
- **Location:** `server/security/memory-rate-limit.ts`; used by every public API route and
  by `submitCheckout`
- **Issue:** The burst limiter stores counters in a module-level `Map`. On Vercel each
  concurrent lambda instance has its own memory, so the effective limit is
  `maxRequests × instanceCount`, and instances recycle constantly.
- **Impact:** The first line of defence on catalogue, search, wishlist, cart-validation and
  checkout is far weaker in production than the configured numbers suggest — which matters
  because the second line (**H-1**) is also broken.
- **Evidence:** `const buckets = new Map<string, Bucket>()` at module scope, with a
  `MAX_TRACKED_IDENTIFIERS` cap that also silently prunes under load.
- **Recommended fix:** Move burst limiting to shared state (Vercel KV / Upstash Redis), or
  accept it as best-effort and rely on a corrected, atomic database limiter (H-1) as the
  real control. Document which one is authoritative.
- **Confidence:** **Confirmed** by code inspection; **Needs Verification** for exact
  instance counts in your deployment.

### M-5 — Order email is never verified

- **Severity:** Medium
- **Category:** Security / Reliability
- **Location:** `server/services/orders.ts` (`guestEmail`),
  `features/checkout/schemas/checkout.ts`
- **Issue:** Guest checkout accepts any syntactically valid email with no verification or
  ownership proof.
- **Impact:** Today: order records attributed to people who did not place them. From Stage
  30 (confirmation emails) this becomes an email-bombing vector — an attacker places orders
  with a victim's address and your domain sends the mail, risking deliverability reputation.
  It also complicates guest order tracking, where email is the natural second factor
  (`SEC-13`).
- **Evidence:** `deliveryDetailsSchema` validates format only; no token, no confirmation
  step, no rate limit keyed on email.
- **Recommended fix:** Rate-limit order creation per email address (independent of IP), and
  before Stage 30 require either a verification code for guest checkout or a signed,
  single-use tracking link rather than raw reference lookup.
- **Confidence:** **Confirmed.**

### M-6 — Stuck `payment_attempts` have no reconciliation path

- **Severity:** Medium
- **Category:** Reliability
- **Location:** `server/services/orders.ts` (payment attempt created at `initialized`)
- **Issue:** Every order creates a `payment_attempts` row at `initialized`. Nothing
  transitions, sweeps or reports on rows that never progress.
- **Impact:** Compounds **C-1**: orders and their reservations accumulate with no operator
  visibility. `PAY-14` (stale pending attempts) has no implementation and no owner yet.
- **Evidence:** No query anywhere filters `payment_attempts.status = 'initialized'` outside
  tests.
- **Recommended fix:** Stage 30 owns this; ensure the reconciliation job covers
  `initialized` (never handed to Paystack), not just `pending`.
- **Confidence:** **Confirmed** (accepted scope gap, flagged so it is not forgotten).

---

## LOW

### L-1 — Dead components shipped in the bundle

- **Severity:** Low · **Category:** Reliability / Performance
- **Location:** `components/commerce/AddToCartButton.tsx`,
  `components/commerce/Price.tsx`
- **Issue:** Neither is imported anywhere (repository-wide grep). `AddToCartButton` was
  superseded by `ProductCardCta`/`ProductPurchase`; `Price` by `Money`.
- **Impact:** Dead code drift — a future edit to the wrong "add to cart" component silently
  does nothing. Minor bundle cost.
- **Recommended fix:** Delete both.
- **Confidence:** **Confirmed.**

### L-2 — Currency is formatted two different ways

- **Severity:** Low · **Category:** Visual Consistency
- **Location:** `components/commerce/Money.tsx` (`Intl.NumberFormat` currency style) vs.
  `components/filters/AppliedFilters.tsx:37,41,44`,
  `components/filters/PriceRange.tsx:76`, `components/filters/ResultCount.tsx:11`
  (manual `` `₦${x.toLocaleString("en-NG")}` ``)
- **Issue:** Two independent money formatters. The manual one hardcodes the symbol and
  placement; the canonical one derives them from the locale.
- **Impact:** Guaranteed drift if currency, locale or fraction rules ever change; filter
  chips can already disagree with product prices.
- **Recommended fix:** Route all of them through the exported `formatMoney` helper.
- **Confidence:** **Confirmed.**

### L-3 — Design tokens bypassed in the `danger` button variant

- **Severity:** Low · **Category:** Visual Consistency
- **Location:** `components/ui/Button.tsx:23` — `hover:bg-red-800 active:bg-red-900`
- **Issue:** Raw Tailwind palette values instead of the `--color-danger` token family that
  every other variant uses. These do not adapt to the dark theme defined in `globals.css`.
- **Impact:** Destructive buttons will look wrong in dark mode and drift from the palette.
- **Recommended fix:** Add `--color-danger-strong` / `--color-danger-stronger` tokens and
  use them.
- **Confidence:** **Confirmed.**

### L-4 — Empty/error state terminology drifts

- **Severity:** Low · **Category:** Visual Consistency
- **Location:** across `components/`, titles collected during audit
- **Issue:** Three unrelated phrasings for the same concept —
  `"Nothing to show yet"`, `"No products found"`, `"Nothing saved yet"` — and two for
  failure: `"Could not load more"` / `"Could not check your cart"` vs.
  `"Section unavailable"` / `"This page could not be loaded"`.
- **Impact:** Reads as several products stitched together; makes copy review and future
  translation harder.
- **Recommended fix:** Standardise on one pattern per state
  (e.g. _"No <things> yet"_ for empty, _"Could not load <thing>"_ for error) and keep the
  next-action sentence structure uniform.
- **Confidence:** **Confirmed.**

### L-5 — "Edit cart" link is below the minimum target size

- **Severity:** Low · **Category:** Accessibility
- **Location:** `components/checkout/CheckoutReview.tsx` — "Edit cart" link
- **Issue:** Measured at **53×21 px**; WCAG 2.2 AA (2.5.8 Target Size Minimum) requires
  24×24.
- **Impact:** Harder to hit on touch, particularly with motor impairment.
- **Evidence:** Measured during the audit sweep. Note that product-title links flagged at
  21px are **false positives** — `ProductCard` expands their hit area to the whole card via
  `after:absolute after:inset-0`. "Edit cart" has no such expansion.
- **Recommended fix:** Add vertical padding to reach 24px, or make the whole "Review items"
  header row the target.
- **Confidence:** **Confirmed.** Measured.

---

## INFORMATIONAL

### I-1 — SQL injection: clean

Covered in full above. No `sql.raw`, no concatenation, all values parameterised, all inputs
additionally Zod-bounded. **This is the strongest area of the codebase.**

### I-2 — Accessibility baseline is genuinely strong

**Zero axe violations** (WCAG 2.0/2.1 A + AA) across 8 routes × 5 viewports
(320 / 390 / 768 / 1440 / 2560 px), including populated and empty states of cart, wishlist
and checkout, and the checkout error state. Semantic landmarks, focus management, live
regions, honeypot hiding and `autocomplete` attributes are all in place. **M-3 is the one
real gap**, and it is invisible to axe because axe does not simulate text scaling.

### I-3 — Money arithmetic is sound

All amounts are integer minor units (kobo); `MONEY_SUBUNIT_FACTOR = 100`; no float
arithmetic on money anywhere. Totals are integer sums, verified by
`grandTotal === subtotal + deliveryTotal` in integration tests. Delivery fees are derived
server-side from `quoteDelivery` and never accepted from the client. `DATA-01` is satisfied.

### I-4 — `RejectedError` is defined but never thrown

`server/services/orders.ts` declares it; all rejections are returned as values (which is
what `primitives/21` asks for). Harmless, but it will read as an oversight to a reviewer.

---

## Prioritised remediation plan

**Phase 1 — before any payment code (blocks Stage 28)**

1. **C-1** — schedule `expireStaleReservations` on a 1–5 minute cron behind a shared secret.
   _Nothing else matters until stock stops leaking._
2. **H-1** — make the rate-limit increment atomic in SQL.
3. **H-2** — stop trusting the leftmost `X-Forwarded-For`; add a non-IP identifier for
   money-path limits.
4. **H-4** — add server-side price-change acknowledgement before Paystack can charge.

**Phase 2 — before public launch**

5. **H-3** — real CSP (`default-src`, nonce `script-src`, `form-action`) + HSTS, rolled out
   report-only first.
6. **M-2** — bind `checkoutAttemptId` replay to a cookie or email.
7. **M-5** — per-email order rate limiting; decide guest-tracking second factor.
8. **M-1** — coarse stock bands on the public cart endpoint.

**Phase 3 — quality**

9. **M-3** — `rem`-based / container-query grids.
10. **M-4, M-6** — shared-state limiter; reconciliation covering `initialized`.
11. **L-1 … L-5**.

---

## Quick wins (low regression risk)

- **L-1** delete two dead components — no importers, zero behavioural risk.
- **L-3** danger-button tokens — pure styling.
- **L-5** "Edit cart" padding — pure styling.
- **L-2** route filter chips through `formatMoney` — small, well covered by existing tests.
- **H-3 (partial)** add `Strict-Transport-Security` and `form-action 'self'` — additive
  headers, no application change. (Full `script-src` needs the nonce work and is _not_ a
  quick win.)
- **M-1** coarse stock bands — one service field plus its consumers; `CART-04` messaging
  already uses the clamped quantity, not the raw count.

---

## Requires architectural change or deeper investigation

- **C-1 / M-6** — reservation lifecycle needs an owner: a scheduler, plus a decision on
  whether to reserve at order creation (current) or at Paystack initialization (safer). This
  interacts with `INV-02` and should be settled _with_ Stage 28, not after.
- **H-2** — correct client-IP derivation is deployment-specific; verify Vercel's header
  behaviour before implementing, and prefer identifiers that are not IP at all for checkout.
- **H-3** — a nonce-based CSP under Next 16 requires middleware/proxy work and will surface
  inline-style and third-party issues; budget a report-only period.
- **H-4** — the acknowledged-total contract touches the cart store, the validation hook, the
  submission schema and the order service simultaneously. Design it once, carefully; it is
  the last structural gap in the money path.
- **M-3** — moving from viewport breakpoints to container queries is a system-wide change to
  the grid primitives, best done deliberately rather than page by page.

---

## Release recommendation

### **Do not ship.**

Not because the codebase is weak — the fundamentals are unusually good for this stage. SQL
injection is properly prevented, output encoding is correct, money is integer-only, the
checkout transaction is genuinely transactional with database-arbitrated races, and the
accessibility baseline passes axe cleanly at five viewports.

The blocker is **C-1**, and it is decisive: **inventory reservations are never released.**
Today, every single order permanently removes stock from sale, and any anonymous visitor can
exhaust the entire 2,257-unit catalogue in a handful of requests without a payment method.
That is not a theoretical concern — I reproduced it accidentally during Stage 27 when the
e2e suite drained a product's stock across runs. Shipping this means the storefront sells
nothing within hours of anyone noticing.

**H-1** and **H-2** compound it by removing the rate limits that would otherwise slow the
attack, and they independently leave staff credentials brute-forceable.

The good news is that the fix is small and the machinery already exists: `expireStaleReservations`
is written, idempotent, batched and tested — it simply has no caller. **C-1, H-1 and H-2
together are a focused day of work, not a redesign.** Once those three land and the sweep is
verified running, this becomes **"Ship with known risks"** for a soft launch, with **H-4**
mandatory before Paystack goes live and **H-3** before broad public exposure.

---

_Audit performed against commit `ae8ad1a` plus uncommitted Stage 27 test harness. Live
checks: axe sweep (8 routes × 5 viewports), text-scaling reflow, XSS probe, overflow and
target-size measurement, repository-wide static analysis of SQL, XSS, authorization and
rate-limiting paths. No application code was modified._
