const MAX_SLUG_LENGTH = 96;

export function slugify(input: string) {
  return input
    .normalize("NFKD")

    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

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

export function buildSku(parts: readonly string[]) {
  return parts
    .map((part) => slugify(part).toUpperCase())
    .filter(Boolean)
    .join("-")
    .slice(0, 96);
}
