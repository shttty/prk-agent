/**
 * A copy of `map` with `changes` merged into the entry at `key`. A missing entry starts from `changes` alone, so `V`
 * is either all-optional (operations) or the key is known to exist (local messages).
 */
export function mergeEntry<V extends object>(map: ReadonlyMap<string, V>, key: string, changes: Partial<V>): Map<string, V> {
  return new Map(map).set(key, Object.assign({}, map.get(key), changes));
}
