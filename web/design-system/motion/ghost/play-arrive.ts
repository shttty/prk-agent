import type { MotionDistance, MotionEdge } from "../motion-types.ts";
import { motionMs } from "../motion-ms.ts";
import { prefersReducedMotion } from "../prefers-reduced-motion.ts";
import { readMotionToken } from "../read-motion-token.ts";
import { shiftToward } from "./shift-toward.ts";

/** A live element arriving from `edge`: it slides in by `distance`. Panels stay opaque throughout (the page never fades
 * in); `fade` is for overlays that float over content (monitor panel), which also come up from transparent. */
export function playArrive(node: HTMLElement | null | undefined, edge: MotionEdge, distance: MotionDistance = "slide", fade = false): void {
  if (!node?.isConnected || prefersReducedMotion()) return;
  const from = { transform: shiftToward(edge, distance), ...(fade ? { opacity: 0 } : {}) };
  node.animate([from, { transform: "none", ...(fade ? { opacity: 1 } : {}) }], { duration: motionMs(fade ? "fast" : "base"), easing: readMotionToken("ease-out") });
}
