import type { MotionDistance, MotionEdge } from "../motion-types.ts";
import type { Ghost } from "./ghost-types.ts";
import { motionMs } from "../motion-ms.ts";
import { readMotionToken } from "../read-motion-token.ts";
import { restoreScrollOffsets } from "./restore-scroll-offsets.ts";
import { shiftToward } from "./shift-toward.ts";
import { stripIdentity } from "./strip-identity.ts";

/** Put a captured copy (capture-ghost.ts) back where it was and slide it out toward `edge` by `distance`, fading; it is
 * inert, has no ids, and removes itself when done. */
export function playGhost(ghost: Ghost | null | undefined, edge: MotionEdge, distance: MotionDistance = "slide"): void {
  if (!ghost) return;
  const { clone, scrolls, rect, fixed, parent, look, drop } = ghost;
  for (const name of drop) clone.classList.remove(name);
  stripIdentity(clone);
  clone.removeAttribute("hidden");
  clone.classList.add("pi-ghost");
  clone.inert = true;
  clone.setAttribute("aria-hidden", "true");
  Object.assign(clone.style, look, { position: fixed ? "fixed" : "absolute", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, margin: "0" });
  parent.append(clone);
  restoreScrollOffsets(clone, scrolls);
  const animation = clone.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: shiftToward(edge, distance) }], { duration: motionMs("base"), easing: readMotionToken("ease-in"), fill: "forwards" });
  animation.onfinish = animation.oncancel = () => clone.remove();
}
