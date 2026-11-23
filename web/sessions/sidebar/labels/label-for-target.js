import { text } from "../text.js";
export function labelForTarget(target) {
  return text(target?.label).trim() || "未命名实例";
}
