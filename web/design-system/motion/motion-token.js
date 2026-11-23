// The --pi-motion-* tokens (tokens.css) for code that needs them as values: WAAPI animations and Mantine's
// transitionProps (a number of ms, it also times the unmount). Read when used, so tokens.css is always loaded.
const root = () => getComputedStyle(document.documentElement);

/** `name` without the prefix, e.g. "fast" → the ms in --pi-motion-fast. */
export function motionMs(name) {
  const value = root().getPropertyValue(`--pi-motion-${name}`).trim();
  return value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1000;
}

/** A curve token as a CSS value, e.g. "ease-swap". */
export const motionEase = (name) => root().getPropertyValue(`--pi-motion-${name}`).trim();

export const prefersReducedMotion = () => document.documentElement.hasAttribute("data-no-animation") || matchMedia("(prefers-reduced-motion: reduce)").matches;
