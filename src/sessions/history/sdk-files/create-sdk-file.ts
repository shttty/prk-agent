import type { HistoryContext } from "../history-types.ts";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { validateLabel } from "../metadata/validate-label.ts";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { openSync, closeSync, unlinkSync } from "node:fs";
import { sessionFile } from "../identity/validate-sdk-file.ts";

export function createFile(ctx: HistoryContext,
  label: string,
  sessionCwd: string,
  append: (manager: SessionManager) => void): { manager: SessionManager; file: string } {
  const { directory } = ctx;
  validateLabel(label);
  const file = join(directory, `${randomUUID()}.jsonl`);
  let created = false;
  try {
    const descriptor = openSync(file, "wx");
    closeSync(descriptor);
    created = true;
    const manager = SessionManager.open(file, directory, sessionCwd);
    const actualFile = sessionFile(manager, file);
    manager.appendSessionInfo(label);
    append(manager);
    return { manager, file: actualFile };
  } catch (error) {
    if (created) {
      try {
        unlinkSync(file);
      } catch { /* Preserve the creation failure. */ }
    }
    throw error;
  }
}
