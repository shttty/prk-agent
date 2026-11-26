
import type { LibraryEntry } from "./capability-types.ts";

// Newest version of each saved name, sorted by name.
export function latest(saved: LibraryEntry[] = []) {
  const sorted = [...saved].sort((a, b) => a.name.localeCompare(b.name) || (b.version || 0) - (a.version || 0));
  return sorted.filter((entry, index) => index === 0 || entry.name !== sorted[index - 1]?.name);
}
