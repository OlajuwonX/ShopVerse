import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buttonStyles,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const ROOT = resolve(import.meta.dirname, "../..");

describe("cn distinguishes font-size utilities from colour utilities", () => {
  const sizes: ButtonSize[] = ["sm", "md", "lg"];

  it("keeps the primary button's text colour at every size", () => {
    for (const size of sizes) {
      expect(buttonStyles({ size, variant: "primary" }), size).toContain(
        "text-surface",
      );
    }
  });

  it("keeps every variant's text colour at every size", () => {
    const expected: Partial<Record<ButtonVariant, string>> = {
      danger: "text-white",
      ghost: "text-text",
      primary: "text-surface",
      secondary: "text-text",
    };

    for (const [variant, colour] of Object.entries(expected)) {
      for (const size of sizes) {
        expect(
          buttonStyles({ size, variant: variant as ButtonVariant }),
          `${variant}/${size}`,
        ).toContain(colour);
      }
    }
  });

  it("still collapses a genuine colour conflict to the last one", () => {
    expect(cn("text-surface", "text-white")).toBe("text-white");
    expect(cn("text-text-muted", "text-danger")).toBe("text-danger");
  });

  it("still collapses a genuine font-size conflict to the last one", () => {
    expect(cn("text-body-sm", "text-caption")).toBe("text-caption");
    expect(cn("text-heading-1", "text-display")).toBe("text-display");
  });

  it("lets a size and a colour coexist, in either order", () => {
    expect(cn("text-body-sm", "text-danger").split(" ").sort()).toStrictEqual([
      "text-body-sm",
      "text-danger",
    ]);
    expect(cn("text-danger", "text-body-sm").split(" ").sort()).toStrictEqual([
      "text-body-sm",
      "text-danger",
    ]);
  });

  it("keeps the price colour on a Money that only overrides its size", () => {
    expect(cn("font-bold text-(--color-price)", "text-body-sm")).toContain(
      "text-(--color-price)",
    );
  });

  it("registers every --text-* token declared in globals.css", () => {
    const css = readFileSync(resolve(ROOT, "app/globals.css"), "utf8");
    const declared = new Set<string>();

    for (const match of css.matchAll(/^\s*--text-([a-z0-9-]+):/gm)) {
      const name = match[1];

      if (name !== undefined && !name.endsWith("--line-height")) {
        declared.add(name);
      }
    }

    expect(declared.size).toBeGreaterThan(0);

    const unregistered = [...declared].filter(
      (name) => cn(`text-${name}`, "text-danger") !== `text-${name} text-danger`,
    );

    expect(unregistered).toStrictEqual([]);
  });
});
