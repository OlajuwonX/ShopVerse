export const MAIN_CONTENT_ID = "main-content";

export function SkipLink() {
  return (
    <a
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-dialog focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:border focus:border-brand focus:bg-surface-raised focus:px-4 focus:text-label focus:font-semibold focus:text-brand-strong"
      href={`#${MAIN_CONTENT_ID}`}
    >
      Skip to content
    </a>
  );
}
