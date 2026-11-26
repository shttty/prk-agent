/** `object` with `field` set, or removed when `value` is undefined. */
export function setField<T extends object, K extends keyof T>(object: T, field: K, value: T[K] | undefined): T {
  const next = { ...object };
  if (value === undefined) delete next[field]; else next[field] = value;
  return next;
}
