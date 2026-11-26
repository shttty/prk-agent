// Ported from @earendil-works/pi-coding-agent 1.6.0 dist/extensions/codemode/tool.js (selectCatalog); the package does not export it.
// On every Pi upgrade, diff it against that file; test/unit/session/code-catalog.test.mjs runs both on the same costs.
export interface CatalogEntry {
  readonly name: string;
  /** Estimated tokens the entry takes in the prompt. */
  readonly cost: number;
}

export interface CatalogGroup {
  readonly entries: readonly CatalogEntry[];
}

/**
 * Pick the entries that fit the budget: in each round every group (the caller orders them) places its cheapest remaining entry; a group whose next entry
 * does not fit drops out while the others continue. Every group is represented before any group is complete. No budget picks everything.
 */
export function selectCatalog(groups: readonly CatalogGroup[], budget: number | undefined): Set<string> {
  if (budget === undefined) return new Set(groups.flatMap((group) => group.entries.map((entry) => entry.name)));
  const queues = groups.map((group) => [...group.entries].sort((a, b) => a.cost - b.cost));
  const shown = new Set<string>();
  let remaining = budget;
  let active = queues.filter((queue) => queue.length > 0);
  while (active.length > 0) {
    active = active.filter((queue) => {
      const next = queue[0]!;
      if (next.cost > remaining) return false;
      remaining -= next.cost;
      shown.add(next.name);
      queue.shift();
      return queue.length > 0;
    });
  }
  return shown;
}
