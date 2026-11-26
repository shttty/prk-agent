import { IN_FLIGHT } from "../../sessions/children/in-flight.ts";
import { statusPriority } from "../../sessions/sidebar/grouping/status-priority.ts";
import type { ChildSession } from "./child-sessions.ts";

// Short words for the summary line; states not listed use their sidebar label.
const WORDS: Record<string, string> = { running: "运行中", blocked: "等待", stopped: "出错", background: "后台运行", done: "有新结果", delivered: "已交付" };

/** How many child sessions sit in each sidebar state, as one line in sidebar priority ("1 等待 · 3 运行中 · 2 已交付"),
 * states with none left out. Everything still at work (starting, running, compacting, cancelling) counts as one "运行中". */
export function childrenSummary(children: readonly Pick<ChildSession, "state">[]) {
  const counts: Record<string, number> = {};
  const words: Record<string, string> = {};
  for (const { state } of children) {
    const key = IN_FLIGHT.has(state.key) || state.key === "compacting" ? "running" : state.key;
    counts[key] = (counts[key] ?? 0) + 1;
    words[key] = WORDS[key] ?? state.label;
  }
  const keys = Object.keys(counts).sort((a, b) => statusPriority(b) - statusPriority(a));
  return { counts, text: keys.map((key) => `${counts[key]} ${words[key]}`).join(" · ") };
}
