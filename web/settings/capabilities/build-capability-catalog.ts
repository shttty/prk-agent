import type { CapabilityData, CapabilityEntry, CapabilityGroup, CatalogView, LibraryEntry } from "./capability-types.ts";
import { CATEGORY_ORDER } from "./provider-categories.ts";
import { categoryOf } from "./provider-categories.ts";
import { BUILTIN } from "./provider-categories.ts";
export function buildCapabilityCatalog(data: CapabilityData | null, kind: "tools" | "skills", library: LibraryEntry[]): CatalogView {
  const catalog = data?.catalog;
  const savedGroup = kind === "skills" ? "group:skills:shared" : "group:tools:library";
  const savedLabel = kind === "skills" ? "沉淀 Skills" : "沉淀工具";
  const savedEmpty = kind === "skills" ? "还没有沉淀的 Skills。模型用 skill_manage 创建的 skill 会出现在这里。" : "还没有沉淀的工具。模型在 kernel 里用 @tool(persist=True) 保存的函数会出现在这里。";
  const entries: CapabilityEntry[] = (catalog?.entries || []).filter((entry) => entry.kind === (kind === "skills" ? "skill" : "tool")).map((entry) => ({
    ...entry, catalogued: true, library: entry.library ? library.find((saved) => saved.name === entry.library?.name) : undefined,
  }));
  const names = new Set(entries.flatMap((entry) => entry.library ? [entry.library.name] : []));
  // Archived/unloaded library records remain manageable, but are not advertised as loaded capabilities.
  for (const saved of library) if (!names.has(saved.name)) entries.push({ id: `library:${kind}:${saved.name}`, name: saved.name, description: saved.description || saved.docstring || "", group: savedGroup, groupLabel: savedLabel, library: saved, catalogued: false });
  // The saved group is always listed under its own name, even before anything is saved.
  const groups: CapabilityGroup[] = (catalog?.groups || []).filter((group) => group.kind === (kind === "skills" ? "skill" : "tool"))
    .map((group) => group.id === savedGroup ? { ...group, name: savedLabel } : group);
  if (!groups.some((group) => group.id === savedGroup)) groups.push({ id: savedGroup, name: savedLabel, available: false });
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.group, (counts.get(entry.group) || 0) + 1);
  // The saved group leads its category: first of 内置 on the tools page, first source on the Skills page.
  const rank = (group: CapabilityGroup) => CATEGORY_ORDER.indexOf(categoryOf(group.id)) * 100 + (group.id === savedGroup ? 0 : categoryOf(group.id) === "builtin" ? Math.max(1, BUILTIN.indexOf(group.id)) : 50);
  const providers = groups.filter((item) => counts.get(item.id) || item.id === savedGroup).map((item, index) => ({ item, index })).sort((a, b) => rank(a.item) - rank(b.item) || (a.item.instance ?? "").localeCompare(b.item.instance ?? "") || a.index - b.index).map(({ item }) => item);
  return { catalog, savedGroup, savedLabel, savedEmpty, entries, names, groups, counts, providers };
}
