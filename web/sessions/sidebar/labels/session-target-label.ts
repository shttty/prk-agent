import type { TargetMap } from "../sidebar-types.ts";
import { labelForTarget } from "./label-for-target.ts";

/** Where a session runs: its instance (the interpreter is the instance's own, so there is nothing per session to add). */
export function sessionTargetLabel(sessionRow: { target?: string }, targets: TargetMap): string {
  const target = targets.get(sessionRow.target ?? "");
  return target ? labelForTarget(target) : "已删除实例";
}
