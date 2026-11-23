
export function capabilityHits(entries, query, providers, selected) {
  const needle = query.trim().toLowerCase();
  const hits = (item) => {
    const rows = entries.filter((entry) => entry.group === item.id);
    if (!needle || item.name.toLowerCase().includes(needle)) return { show: true, all: true, rows };
    const matched = rows.filter((entry) => `${entry.name}\n${entry.description || ""}`.toLowerCase().includes(needle));
    return { show: matched.length > 0, all: false, rows: matched };
  };
  const visible = providers.filter((item) => hits(item).show);
  const current = providers.find((item) => item.id === selected) ?? visible[0] ?? providers[0];
  return { needle, hits, visible, current };
}
