import type { SessionRow } from "../../../workbench/store/store-types.ts";
import { BUSY_STATES } from "../sidebar-constants.ts";
import { stateLabel } from "./state-label.ts";
import { stateTone, type StateTone } from "./state-tone.ts";

export type RowState = { key: string; label: string; tone: StateTone };
const DELIVERED_PHASES = new Set(["submitted", "delivered"]);

/** The one state a session row shows, and the dot tone that goes with it. A child session that handed in its result
 * (derivation phase submitted/delivered) and is not running again reads "已交付". */
export function rowState(sessionRow: SessionRow): RowState {
  if (sessionRow.blocked) return { key: "blocked", label: "等待处理", tone: "warn" };
  if (sessionRow.stopped) return { key: "stopped", label: "出错停下", tone: "error" };
  if (sessionRow.retryPending) return { key: "running", label: stateLabel("running"), tone: stateTone("running") };
  if (sessionRow.background && sessionRow.state === "idle") return { key: "background", label: "后台运行中", tone: "run" };
  if (sessionRow.done && (sessionRow.state === "idle" || sessionRow.state === "sleeping")) return { key: "done", label: "有新结果", tone: "ok" };
  if (sessionRow.state === "running" && sessionRow.compacting) return { key: "compacting", label: "压缩中", tone: stateTone("running") };
  const phase = sessionRow.derivation?.phase;
  const delivered = phase !== undefined && DELIVERED_PHASES.has(phase) && !BUSY_STATES.has(sessionRow.state);
  return delivered ? { key: "delivered", label: "已交付", tone: "ok" } : { key: sessionRow.state, label: stateLabel(sessionRow.state), tone: stateTone(sessionRow.state) };
}
