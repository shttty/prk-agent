export function prefersReducedMotion(): boolean {
  return document.documentElement.hasAttribute("data-no-animation") || matchMedia("(prefers-reduced-motion: reduce)").matches;
}
