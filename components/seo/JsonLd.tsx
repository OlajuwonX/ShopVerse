const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

export function serialiseJsonLd(data: unknown) {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(LINE_SEPARATOR)
    .join("\\u2028")
    .split(PARAGRAPH_SEPARATOR)
    .join("\\u2029");
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: serialiseJsonLd(data) }}
      type="application/ld+json"
    />
  );
}

export type BreadcrumbTrail = {
  href?: string;
  label: string;
};

export function buildBreadcrumbJsonLd(
  items: readonly BreadcrumbTrail[],
  origin: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      name: item.label,
      position: index + 1,
      ...(item.href ? { item: new URL(item.href, origin).toString() } : {}),
    })),
  };
}
