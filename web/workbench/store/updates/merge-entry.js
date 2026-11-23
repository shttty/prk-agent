
export function mergeEntry(ctx, map, key, changes) {
    return new Map(map).set(key, { ...map.get(key), ...changes });
  }

