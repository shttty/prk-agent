/**
 * One three-way mode per tool (or tool group) instead of the 启用 + 懒加载 switches:
 * off = enabled false; lazy = enabled and lazy on; resident = enabled and lazy off. Items without a `lazy` field
 * (kernel functions, skills, Pi native tools) only have off / on.
 */
export function toolMode(item) {
  if (!(item.locked === true || item.configured === true || item.enabled === true)) return "off";
  if (!item.lazy) return "on";
  return item.lazy.enabled === true ? "lazy" : "resident";
}

/** A group's own mode, or null when its catalogued members disagree (shown as 混合). */
export function groupMode(group, members) {
  if (group.enabled === false) return "off";
  const modes = new Set(members.filter((entry) => entry.catalogued && !entry.moduleOnly).map(toolMode));
  if (modes.size > 1) return null;
  return toolMode(group);
}

/** Writes that move an item from its current state to `mode` (enable id first, then the lazy id). */
export function modeChanges(item, mode) {
  const writes = [];
  const enabled = mode !== "off";
  if (enabled !== (toolMode(item) !== "off")) writes.push({ id: item.id, enabled });
  if (enabled && item.lazy?.id && (mode === "lazy") !== (item.lazy.enabled === true)) writes.push({ id: item.lazy.id, enabled: mode === "lazy" });
  return writes;
}

/** Group line: built-in and plugin groups expose `group.lazy` from the catalog; groups without it fall back to off/on. */
export function groupItem(group) {
  return { item: group, writes: (mode) => modeChanges(group, mode) };
}

/** First sentence of a description, for the one grey line under the name. */
export function firstSentence(text) {
  const value = typeof text === "string" ? text.trim() : "";
  const match = /^.*?[.。!?！？](?=\s|$)/su.exec(value);
  return (match ? match[0] : value.split("\n")[0]).trim();
}
