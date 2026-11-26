/** Tool groups a plugin package provides in the capability catalog: `group:tools:package:<name>` and its remote twins. */
export function pluginToolGroups(catalog, name) {
  const groups = (catalog?.groups ?? []).filter((group) => group.kind === "tool" && group.id.endsWith(`:${name}`) && (group.id.includes(":package:") || group.id.includes(":remote:")));
  const ids = new Set(groups.map((group) => group.id));
  return { groupId: groups[0]?.id, count: (catalog?.entries ?? []).filter((entry) => entry.kind === "tool" && ids.has(entry.group)).length };
}
