
export function visibleEntries(entries, { showHidden = false, query = "" } = {}) {
  const needle = query.trim().toLowerCase();
  return (entries || []).filter((entry) => (showHidden || !entry.name.startsWith(".")) && (!needle || entry.name.toLowerCase().includes(needle)));
}
