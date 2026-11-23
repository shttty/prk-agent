import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { fileEdits } from "./read-file-edits.ts";

/** All of the agent's edits of one file, oldest first, in one Pi-format diff with a gap row between calls. */
export function agentDiff(entries: readonly SessionEntry[], path: string): string {
  return fileEdits(entries).filter((edit) => edit.path === path).map((edit) => edit.diff).join("\n \n");
}
