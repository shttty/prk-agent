import { labelForTarget } from "../labels/label-for-target.js";
import { text } from "../text.js";
export function instanceGroups(items, targets) {
  const groups = new Map();
  for (const target of targets) groups.set(target.id, {
    id: target.id,
    name: labelForTarget(target),
    target,
    sessions: [],
  });
  for (const sessionRow of items) {
    const targetName = text(sessionRow?.target).trim();
    const id = groups.has(targetName) ? targetName : `missing:${targetName || (sessionRow.sessionId || sessionRow.key)}`;
    const group = groups.get(id) || { id, name: "已删除实例", target: null, sessions: [] };
    group.sessions.push(sessionRow);
    groups.set(id, group);
  }
  return [...groups.values()];
}
