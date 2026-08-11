/**
 * Slug generation (DATA-03, primitives/11-products.md).
 *
 * Slugs are permanent-ish public surface — `/products/[slug]`, `/categories/[slug]` —
 * so generation is deterministic and uniqueness is enforced by a database unique
 * index, not by hoping names never repeat.
 */
const MAX_SLUG_LENGTH = 96;

export function slugify(input: string) {
  return (
    input
      .normalize("NFKD")
      // Strip combining marks so "Café" becomes "cafe" rather than "caf".
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_SLUG_LENGTH)
      .replace(/-+$/g, "")
  );
}

/**
 * Resolves a slug against slugs already in use.
 *
 * Disambiguation is deterministic (`-2`, `-3`, …) rather than random, so the same
 * inputs in the same order always produce the same slugs — a seed re-run or a
 * replayed import does not churn public URLs.
 */
export function uniqueSlug(input: string, taken: ReadonlySet<string>) {
  const base = slugify(input) || "item";

  if (!taken.has(base)) {
    return base;
  }

  let suffix = 2;
  let candidate = `${base}-${suffix}`;

  while (taken.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

/**
 * SKUs are internal, but they are printed on order snapshots and admin screens,
 * so they stay readable and stable rather than random.
 *
 * Word separators are preserved and parts are not truncated: abbreviating each
 * part collapsed distinct products onto the same SKU ("Samsung Galaxy S24
 * Ultra" and "Samsung Galaxy Tab S9 FE" both reduced to `SAMSUNGG`). Uniqueness
 * therefore derives from the product slug, which already carries a unique index.
 */
export function buildSku(parts: readonly string[]) {
  return parts
    .map((part) => slugify(part).toUpperCase())
    .filter(Boolean)
    .join("-")
    .slice(0, 96);
}
