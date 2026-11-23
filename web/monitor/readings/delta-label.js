
export function deltaLabel(sessionRow) {
  const changes = sessionRow?.monitor?.changes;
  if (!changes) return null;
  const compact = (value) => (value >= 10000 ? `${Math.round(value / 1000)}k` : value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value));
  if (changes.added > 0) return `+${compact(changes.added)}`;
  if (changes.removed > 0) return `-${compact(changes.removed)}`;
  return changes.files?.length > 0 ? "±" : null;
}
