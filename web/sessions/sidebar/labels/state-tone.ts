import { BUSY_STATES } from "../sidebar-constants.ts";

export type StateTone = "ok" | "error" | "warn" | "idle" | "sleep" | "run";

export function stateTone(value: string | undefined): StateTone {
  if (value === "unavailable") return "error";
  if (value === "sleeping") return "sleep";
  if (value && BUSY_STATES.has(value)) return "run";
  if (value === "idle") return "ok";
  return "idle";
}
