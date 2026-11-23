import { text } from "../text.js";
import { labelForTarget } from "./label-for-target.js";
/** Where a session runs: its instance (the interpreter is the instance's own, so there is nothing per session to add). */
export function sessionTargetLabel(sessionRow, targets) {
  const target = targets.get(text(sessionRow?.target));
  return target ? labelForTarget(target) : "已删除实例";
}
