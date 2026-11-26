import type { DirEntry } from "./path-types.ts";

export function visibleEntries(entries: readonly DirEntry[] | null | undefined, { showHidden = false, query = "" }: { showHidden?: boolean; query?: string } = {}) {
  const needle = query.trim().toLowerCase();
  return (entries || []).filter((entry) => (showHidden || !entry.name.startsWith(".")) && (!needle || entry.name.toLowerCase().includes(needle)));
}
