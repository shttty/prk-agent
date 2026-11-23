import { CATEGORY_ORDER } from "./provider-categories.js";
import { categoryOf } from "./provider-categories.js";
import { BUILTIN } from "./provider-categories.js";
export function buildCapabilityCatalog(data, kind, library) {
  const catalog = data?.catalog;
  const savedGroup = kind === "skills" ? "group:skills:shared" : "group:tools:library";
  const savedLabel = kind === "skills" ? "PRK 共享库" : "沉淀工具";
  const entries = (catalog?.entries || []).filter((entry) => entry.kind === (kind === "skills" ? "skill" : "tool")).map((entry) => ({
    ...entry, catalogued: true, library: entry.library ? library.find((saved) => saved.name === entry.library.name) : undefined,
  }));
  const names = new Set(entries.filter((entry) => entry.library).map((entry) => entry.library.name));
  // Archived/unloaded library records remain manageable, but are not advertised as loaded capabilities.
  for (const saved of library) if (!names.has(saved.name)) entries.push({ id: `library:${kind}:${saved.name}`, name: saved.name, description: saved.description || saved.docstring || "", group: savedGroup, groupLabel: savedLabel, library: saved, catalogued: false });
  const groups = (catalog?.groups || []).filter((group) => group.kind === (kind === "skills" ? "skill" : "tool"));
  if (library.length && !groups.some((group) => group.id === savedGroup)) groups.push({ id: savedGroup, name: savedLabel, available: false });
  const counts = new Map();
  for (const entry of entries) counts.set(entry.group, (counts.get(entry.group) || 0) + 1);
  const rank = (group) => CATEGORY_ORDER.indexOf(categoryOf(group.id)) * 100 + (categoryOf(group.id) === "builtin" ? Math.max(0, BUILTIN.indexOf(group.id)) : 50);
  const providers = groups.filter((item) => counts.get(item.id)).map((item, index) => ({ item, index })).sort((a, b) => rank(a.item) - rank(b.item) || (a.item.instance ?? "").localeCompare(b.item.instance ?? "") || a.index - b.index).map(({ item }) => item);
  return { catalog, savedGroup, savedLabel, entries, names, groups, counts, providers };
}
