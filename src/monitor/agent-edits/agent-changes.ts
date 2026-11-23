import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { AgentChanges } from "../session-monitor/session-monitor-types.ts";
import { fileEdits } from "./read-file-edits.ts";

/**
 * The agent's change volume: files it wrote or edited in this session branch (distinct paths) with line counts summed over
 * every successful call. Not a net diff and nothing is read from the files (a file edited twice counts both edits).
 * Derived from the SDK history on demand; nothing is stored.
 */
export function agentChanges(entries: readonly SessionEntry[]): AgentChanges {
  const byPath = new Map<string, { added: number; removed: number }>();
  for (const edit of fileEdits(entries)) {
    const total = byPath.get(edit.path) ?? { added: 0, removed: 0 };
    total.added += edit.added;
    total.removed += edit.removed;
    byPath.set(edit.path, total);
  }
  const files = [...byPath].sort(([left], [right]) => left.localeCompare(right))
    .map(([path, total]) => ({ path, status: "M", added: total.added, removed: total.removed, binary: false }));
  return { files, added: files.reduce((sum, file) => sum + file.added, 0), removed: files.reduce((sum, file) => sum + file.removed, 0) };
}
