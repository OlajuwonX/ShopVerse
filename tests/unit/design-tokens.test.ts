import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const GLOBALS_CSS = resolve(ROOT, "app/globals.css");
const SOURCE_DIRS = ["app", "components", "features", "hooks", "lib"];

function collectSourceFiles(dir: string): string[] {
  const absolute = resolve(ROOT, dir);
  const entries: string[] = [];

  for (const name of readdirSync(absolute)) {
    const full = join(absolute, name);

    if (statSync(full).isDirectory()) {
      entries.push(...collectSourceFiles(join(dir, name)));
      continue;
    }

    if ([".ts", ".tsx"].includes(extname(name))) {
      entries.push(full);
    }
  }

  return entries;
}

const css = readFileSync(GLOBALS_CSS, "utf8");
const sourceFiles = SOURCE_DIRS.flatMap(collectSourceFiles);

function declaredTokens(prefix: string) {
  return new Set(
    [...css.matchAll(new RegExp(`--${prefix}-([a-z0-9-]+)\\s*:`, "g"))].map(
      (match) => match[1] ?? "",
    ),
  );
}

function usedUtilities(pattern: RegExp) {
  const used = new Map<string, string[]>();

  for (const file of sourceFiles) {
    const contents = readFileSync(file, "utf8");

    for (const match of contents.matchAll(pattern)) {
      const name = match[1];

      if (!name) {
        continue;
      }

      used.set(name, [...(used.get(name) ?? []), file.replace(ROOT, "")]);
    }
  }

  return used;
}

describe("z-index scale", () => {
  const declared = declaredTokens("z-index");

  it("declares the full stacking scale", () => {
    for (const layer of ["header", "sticky", "drawer", "dialog", "toast"]) {
      expect(declared).toContain(layer);
    }
  });

  it("uses the namespace Tailwind actually generates utilities from", () => {
    expect(css).toMatch(/--z-index-header\s*:/);
    expect(css).not.toMatch(/--z-header\s*:/);
  });

  it("resolves every semantic z-* utility used in source to a declared token", () => {
    const used = usedUtilities(/(?:^|[\s"'`:])z-([a-z][a-z0-9-]*)(?=[\s"'`]|$)/gm);
    const unresolved: string[] = [];

    for (const [name, files] of used) {
      if (!declared.has(name)) {
        unresolved.push(`z-${name} (used in ${files.join(", ")})`);
      }
    }

    expect(unresolved).toStrictEqual([]);
  });

  it("orders the scale so overlays cover the header", () => {
    const value = (layer: string) =>
      Number(
        css.match(new RegExp(`--z-index-${layer}\\s*:\\s*(\\d+)`))?.[1] ?? Number.NaN,
      );

    expect(value("header")).toBeLessThan(value("sticky"));
    expect(value("sticky")).toBeLessThan(value("drawer"));
    expect(value("drawer")).toBeLessThan(value("dialog"));
    expect(value("dialog")).toBeLessThan(value("toast"));
  });

  it("keeps the header above any numeric z-index used in components", () => {
    const headerValue = Number(css.match(/--z-index-header\s*:\s*(\d+)/)?.[1]);
    const numeric = [
      ...usedUtilities(/(?:^|[\s"'`:])z-(\d+)(?=[\s"'`]|$)/gm).keys(),
    ].map(Number);

    for (const value of numeric) {
      expect(value).toBeLessThan(headerValue);
    }
  });
});

describe("design tokens referenced by components exist", () => {
  it("resolves every ease-* utility to a declared token", () => {
    const declared = declaredTokens("ease");
    const used = usedUtilities(/(?:^|[\s"'`:])ease-([a-z][a-z0-9-]*)(?=[\s"'`]|$)/gm);
    const builtIn = new Set(["in", "out", "in-out", "linear", "initial"]);
    const unresolved: string[] = [];

    for (const [name, files] of used) {
      if (!declared.has(name) && !builtIn.has(name)) {
        unresolved.push(`ease-${name} (used in ${files.join(", ")})`);
      }
    }

    expect(unresolved).toStrictEqual([]);
  });

  it("resolves every shadow-* utility to a declared token", () => {
    const declared = declaredTokens("shadow");
    const used = usedUtilities(/(?:^|[\s"'`:])shadow-([a-z][a-z0-9-]*)(?=[\s"'`]|$)/gm);
    const builtIn = new Set([
      "sm",
      "md",
      "lg",
      "xl",
      "2xl",
      "inner",
      "none",
      "initial",
    ]);
    const unresolved: string[] = [];

    for (const [name, files] of used) {
      if (!declared.has(name) && !builtIn.has(name)) {
        unresolved.push(`shadow-${name} (used in ${files.join(", ")})`);
      }
    }

    expect(unresolved).toStrictEqual([]);
  });
});
