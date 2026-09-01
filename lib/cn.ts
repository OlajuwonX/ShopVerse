import { extendTailwindMerge } from "tailwind-merge";

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
