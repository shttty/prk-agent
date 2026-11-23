import { BUSY_STATES } from "../sidebar-constants.js";
export function stateTone(value) {
  if (value === "unavailable") return "error";
  if (value === "sleeping") return "sleep";
  if (BUSY_STATES.has(value)) return "run";
  if (value === "idle") return "ok";
  return "idle";
}
