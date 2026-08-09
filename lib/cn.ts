export function cn(...classes: Array<false | null | string | undefined>) {
  return classes.filter(Boolean).join(" ");
}
