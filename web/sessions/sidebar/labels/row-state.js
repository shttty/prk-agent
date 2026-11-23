import { BUSY_STATES } from "../sidebar-constants.js";
import { stateLabel } from "./state-label.js";
import { stateTone } from "./state-tone.js";
export const DELIVERED_PHASES = new Set(["submitted", "delivered"]);

/** The one state a session row shows, and the dot tone that goes with it. A child session that handed in its result
 * (derivation phase submitted/delivered) and is not running again reads "已交付". */
export function rowState(sessionRow) {
  const delivered = DELIVERED_PHASES.has(sessionRow?.derivation?.phase) && !BUSY_STATES.has(sessionRow?.state);
  return delivered ? { key: "delivered", label: "已交付", tone: "ok" } : { key: sessionRow?.state, label: stateLabel(sessionRow?.state), tone: stateTone(sessionRow?.state) };
}
