export function filterProjectEntries(entries) {
  return entries.filter((entry) => entry.enabled && entry.metadata.scope === "project");
}
