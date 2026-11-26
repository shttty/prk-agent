import type { LazyState } from "../capability-types.ts";

/** What a mode applies to: a tool or a tool group. */
export type ModeItem = { id: string; enabled?: boolean; locked?: boolean; configured?: boolean; lazy?: LazyState; catalogued?: boolean; moduleOnly?: boolean };

export type ToolModeName = "off" | "on" | "lazy" | "resident";

/**
 * One three-way mode per tool (or tool group) instead of the 启用 + 懒加载 switches:
 * off = enabled false; lazy = enabled and lazy on; resident = enabled and lazy off. Items without a `lazy` field
 * (kernel functions, skills, Pi native tools) only have off / on.
 */
export function toolMode(item: ModeItem): ToolModeName {
  if (!(item.locked === true || item.configured === true || item.enabled === true)) return "off";
  if (!item.lazy) return "on";
  return item.lazy.enabled === true ? "lazy" : "resident";
}
