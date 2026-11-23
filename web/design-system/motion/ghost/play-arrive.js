import { motionMs } from "../motion-token.js";
import { motionEase } from "../motion-token.js";
import { prefersReducedMotion } from "../motion-token.js";
import { shiftToward } from "./shift-toward.js";

/** A live element arriving from `edge`: it slides in by `distance`. Panels stay opaque throughout (the page never fades
 * in); `fade` is for overlays that float over content (monitor panel), which also come up from transparent. */
export function playArrive(node, edge, distance = "slide", fade = false) {
  if (!node?.isConnected || prefersReducedMotion()) return;
  const from = { transform: shiftToward(edge, distance), ...(fade ? { opacity: 0 } : {}) };
  node.animate([from, { transform: "none", ...(fade ? { opacity: 1 } : {}) }], { duration: motionMs(fade ? "fast" : "base"), easing: motionEase("ease-out") });
}
