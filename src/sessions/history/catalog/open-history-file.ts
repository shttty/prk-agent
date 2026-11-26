import { statSync } from "node:fs";
import { basename } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { recordSerialization } from "../../../metrics/timing/record-serialization.ts";

/** Pi reads and parses the whole JSONL synchronously here; the time and size feed the stall metrics. */
export function openHistoryFile(file: string, directory: string, cwd?: string): SessionManager {
  const bytes = statSync(file).size;
  const started = performance.now();
  let manager: SessionManager | undefined;
  try { return manager = SessionManager.open(file, directory, cwd); }
  finally { recordSerialization("history_load", started, bytes, () => manager?.getSessionId() ?? basename(file, ".jsonl")); }
}
