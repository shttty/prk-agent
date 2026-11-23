
export function withPending(pending, key, active) {
  const next = new Set(pending);
  if (active) next.add(key);
  else next.delete(key);
  return next;
}

