import type { PublicExecutionTarget } from "../../../../src/gateway/wire/web-types.ts";
import type { Groupable, SessionGroup } from "../sidebar-types.ts";
import { labelForTarget } from "../labels/label-for-target.ts";
import { itemIdentity } from "./item-identity.ts";

export function instanceGroups<Item extends Groupable>(items: readonly Item[], targets: readonly PublicExecutionTarget[]): SessionGroup<Item>[] {
  const groups = new Map<string, SessionGroup<Item>>();
  for (const target of targets) groups.set(target.id, { id: target.id, name: labelForTarget(target), target, sessions: [] });
  for (const sessionRow of items) {
    const targetName = (sessionRow.target ?? "").trim();
    const id = groups.has(targetName) ? targetName : `missing:${targetName || itemIdentity(sessionRow)}`;
    const group = groups.get(id) ?? { id, name: "已删除实例", target: null, sessions: [] };
    group.sessions.push(sessionRow);
    groups.set(id, group);
  }
  return [...groups.values()];
}
