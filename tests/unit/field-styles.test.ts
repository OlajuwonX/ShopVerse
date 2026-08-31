import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  FIELD_FOCUS,
  FIELD_FOCUS_INVALID,
  FIELD_TEXT,
} from "@/components/ui/field-styles";

const ROOT = resolve(import.meta.dirname, "../..");
const SOURCE_DIRS = ["app", "components", "features"];
const GLOBALS_CSS = resolve(ROOT, "app/globals.css");

const SMALL_TEXT = ["text-body-sm", "text-label", "text-caption"];

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

function readTag(source: string, start: number) {
  let depth = 0;
  let quote: string | null = null;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];

    if (quote !== null) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
    } else if (char === ">" && depth === 0) {
      return source.slice(start, i + 1);
    }
  }

  return null;
}

function collectFormControls() {
  const controls: { file: string; tag: string }[] = [];

  for (const file of SOURCE_DIRS.flatMap(collectSourceFiles)) {
    const source = readFileSync(resolve(ROOT, file), "utf8");

    for (const match of source.matchAll(/<(input|select|textarea)(?=[\s/>])/g)) {
      const tag = readTag(source, match.index);

      if (tag !== null) {
        controls.push({ file, tag });
      }
    }
  }

  return controls;
}

function isFocusableTextEntry(tag: string) {
  const type = /type=["']([a-z]+)["']/.exec(tag)?.[1];

  if (type !== undefined && NON_TEXT_TYPES.includes(type)) {
    return false;
  }

  return !tag.includes("tabIndex={-1}");
}

describe("shared field styling", () => {
  it("finds the form controls it is meant to be checking", () => {
    expect(
      collectFormControls().filter(({ tag }) => isFocusableTextEntry(tag)).length,
    ).toBeGreaterThan(3);
  });

  it("keeps the opt-up to 16px inside FIELD_TEXT", () => {
    expect(FIELD_TEXT).toContain("pointer-coarse:text-body");
  });

  it("keeps the search treatment inside FIELD_FOCUS, with a width that exists", () => {
    expect(FIELD_FOCUS).toContain("focus-visible:border-text");
    expect(FIELD_FOCUS).toContain("focus-visible:outline-text");
    expect(FIELD_FOCUS).not.toMatch(/outline-1\.5(?![\d\]])/);
    expect(FIELD_FOCUS).toMatch(/focus-visible:outline-\[[\d.]+px\]/);
  });

  it("keeps the invalid state distinguishable while focused", () => {
    expect(FIELD_FOCUS_INVALID).toContain("focus-visible:outline-danger");
    expect(FIELD_FOCUS_INVALID).not.toEqual(FIELD_FOCUS);
  });

  it("focuses every text field the same way", () => {
    const offenders: string[] = [];

    for (const { file, tag } of collectFormControls()) {
      if (!isFocusableTextEntry(tag)) {
        continue;
      }

      const usesShared = /\bFIELD_FOCUS\b/.test(tag);
      const rollsItsOwn = /focus-visible:(outline|border)-/.test(tag);

      if (!usesShared) {
        offenders.push(
          `${file}: ${rollsItsOwn ? "declares its own focus ring" : "declares no focus ring"} instead of FIELD_FOCUS`,
        );
      }
    }

    expect(offenders).toStrictEqual([]);
  });

  it("gives every text field a 16px size on a coarse pointer", () => {
    const offenders: string[] = [];

    for (const { file, tag } of collectFormControls()) {
      if (!isFocusableTextEntry(tag)) {
        continue;
      }

      if (/\bFIELD_TEXT\b/.test(tag)) {
        continue;
      }

      const small = SMALL_TEXT.filter((size) =>
        new RegExp(`(?<![\\w:-])${size}(?![\\w-])`).test(tag),
      );

      offenders.push(
        small.length > 0
          ? `${file}: ${small.join(", ")} without the coarse-pointer opt-up`
          : `${file}: does not use FIELD_TEXT, so its size is unguarded`,
      );
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
