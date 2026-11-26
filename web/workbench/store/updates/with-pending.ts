export function withPending<K extends string>(pending: ReadonlySet<K>, key: K, active: boolean): Set<K> {
  const next = new Set(pending);
  if (active) next.add(key);
  else next.delete(key);
  return next;
}
