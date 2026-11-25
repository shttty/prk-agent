import { IN_FLIGHT } from "../../sessions/children/in-flight.js";
import { statusPriority } from "../../sessions/sidebar/grouping/highest-under.js";

/** How many child sessions sit in each sidebar state, the ones needing attention first. Everything still at work
 * (starting, running, compacting, cancelling) counts as one "运行中". */
export function childrenSummary(children) {
  const groups = new Map();
  for (const { state } of children) {
    const running = IN_FLIGHT.has(state.key) || state.key === "compacting";
    const key = running ? "running" : state.key;
    const group = groups.get(key) ?? { key, label: running ? "运行中" : state.label, tone: state.tone, count: 0 };
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => statusPriority(b.key) - statusPriority(a.key));
}
