import type { MotionDuration, MotionEase } from "./motion-types.ts";

/** The raw --pi-motion-* property, e.g. "ease-swap" → its cubic-bezier. Read when used, so tokens.css is always loaded. */
export function readMotionToken(name: MotionDuration | MotionEase): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--pi-motion-${name}`).trim();
}
