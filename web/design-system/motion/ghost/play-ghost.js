import { motionMs } from "../motion-token.js";
import { motionEase } from "../motion-token.js";
import { stripIdentity } from "./strip-identity.js";
import { shiftToward } from "./shift-toward.js";

/** Put a captured copy (capture-ghost.js) back where it was and slide it out toward `edge` by `distance` (a
 * --pi-motion-* length token), fading; it is inert, has no ids, and removes itself when done. */
export function playGhost(ghost, edge, distance = "slide") {
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
  const nodes = [clone, ...clone.querySelectorAll("*")];
  for (const [index, top, left] of scrolls) { nodes[index].scrollTop = top; nodes[index].scrollLeft = left; }
  const animation = clone.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: shiftToward(edge, distance) }], { duration: motionMs("base"), easing: motionEase("ease-in"), fill: "forwards" });
  animation.onfinish = animation.oncancel = () => clone.remove();
}
