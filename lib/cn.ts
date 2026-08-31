import { extendTailwindMerge } from "tailwind-merge";

/**
 * Font sizes come from the `--text-*` theme variables in `globals.css`, so `text-label`
 * and `text-body-sm` are font-size utilities. tailwind-merge cannot tell them apart from
 * colour utilities such as `text-surface`, and by default assumes any unknown `text-*` is
 * a colour — so it treated the two as conflicting and kept only the last one.
 *
 * That silently stripped the colour off every button. `buttonStyles` composes
 * `cn(BASE, variant, size)`, the variant carries `text-surface` and every size carries a
 * `text-*` font size, so the colour was dropped and the label fell back to inheriting
 * `--color-text`: dark text on a dark button in light mode, light on light in dark mode.
 *
 * Registering the names here restores the distinction. Keep this list in step with the
 * `--text-*` variables.
 */
const FONT_SIZES = [
  "display",
  "heading-1",
  "heading-2",
  "heading-3",
  "body",
  "body-sm",
  "label",
  "caption",
  "price",
  "price-lg",
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: FONT_SIZES }],
    },
  },
});

export function cn(...classes: Array<false | null | string | undefined>) {
  return twMerge(classes.filter(Boolean).join(" "));
}
