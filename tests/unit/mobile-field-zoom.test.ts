import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const SOURCE_DIRS = ["app", "components", "features"];
const GLOBALS_CSS = resolve(ROOT, "app/globals.css");

/** `text-*` utilities whose declared size is below the 16px iOS zoom threshold. */
const SMALL_TEXT = ["text-body-sm", "text-label", "text-caption"];

/** The escape hatch: a field that opts back up to 16px on a touch pointer. */
const MOBILE_SAFE = "pointer-coarse:text-body";

/**
 * Input types that carry no text entry. iOS never zooms for these, and forcing 16px on
 * them would only distort the control.
 */
const NON_TEXT_TYPES = ["checkbox", "radio", "range", "color", "file", "hidden"];

function collectSourceFiles(dir: string): string[] {
  const found: string[] = [];

  for (const name of readdirSync(resolve(ROOT, dir))) {
    const relative = join(dir, name);

    if (statSync(resolve(ROOT, relative)).isDirectory()) {
      found.push(...collectSourceFiles(relative));
      continue;
    }

    if (relative.endsWith(".tsx")) {
      found.push(relative);
    }
  }

  return found;
}

/** Each `<input|select|textarea …>` opening tag, with its attributes. */
function collectFormControls() {
  const controls: { file: string; tag: string }[] = [];

  for (const file of SOURCE_DIRS.flatMap(collectSourceFiles)) {
    const source = readFileSync(resolve(ROOT, file), "utf8");

    // `[^>]` already spans newlines, so this needs no dotAll flag — which the ES2017
    // target does not allow anyway.
    for (const match of source.matchAll(/<(input|select|textarea)(\s[^>]*?)?\/?>/g)) {
      controls.push({ file, tag: match[0] });
    }
  }

  return controls;
}

function isTextEntry(tag: string) {
  const type = /type=["']([a-z]+)["']/.exec(tag)?.[1];

  if (type !== undefined && NON_TEXT_TYPES.includes(type)) {
    return false;
  }

  // The honeypots are real text inputs but sit inside an aria-hidden, 1px, zero-opacity
  // wrapper. A person cannot focus one, so it cannot trigger a zoom.
  return !tag.includes("tabIndex={-1}");
}

describe("form fields do not trigger the iOS focus zoom", () => {
  it("finds the form controls it is meant to be checking", () => {
    expect(collectFormControls().length).toBeGreaterThan(5);
  });

  it("gives every text-entry field a 16px size on a coarse pointer", () => {
    const offenders: string[] = [];

    for (const { file, tag } of collectFormControls()) {
      if (!isTextEntry(tag)) {
        continue;
      }

      const small = SMALL_TEXT.filter((size) =>
        new RegExp(`(?<![\\w:-])${size}(?![\\w-])`).test(tag),
      );

      if (small.length > 0 && !tag.includes(MOBILE_SAFE)) {
        offenders.push(`${file}: ${small.join(", ")} without ${MOBILE_SAFE}`);
      }
    }

    expect(offenders).toStrictEqual([]);
  });

  it("keeps the opt-up token at or above 16px", () => {
    const css = readFileSync(GLOBALS_CSS, "utf8");
    const declared = /^\s*--text-body:\s*([\d.]+)rem;/m.exec(css)?.[1];

    expect(declared).toBeDefined();
    expect(Number(declared) * 16).toBeGreaterThanOrEqual(16);
  });

  it("does not scale the root font size, which the 16px threshold assumes", () => {
    const css = readFileSync(GLOBALS_CSS, "utf8");
    const htmlRule = /html\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";

    expect(htmlRule).not.toMatch(/font-size/);
  });
});
