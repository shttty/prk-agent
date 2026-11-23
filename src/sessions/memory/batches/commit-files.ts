import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { FileEdit } from "../memory-types.ts";

/** Stage all files before publishing. Roll back already-published files on an I/O failure. */
export function commit(edits: Map<string, FileEdit>): void {
  const staged = new Map<string, string>();
  const published: string[] = [];
  try {
    for (const [path, edit] of edits) {
      if (edit.after === undefined) continue;
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      const temporary = `${path}.${randomUUID()}.tmp`;
      staged.set(path, temporary);
      writeFileSync(temporary, edit.after, { mode: 0o600 });
    }
    for (const [path, edit] of edits) {
      if (edit.after === undefined) rmSync(path, { force: true });
      else renameSync(staged.get(path)!, path);
      published.push(path);
    }
  } catch (error) {
    const failures: unknown[] = [error];
    for (const path of published.reverse()) {
      try {
        const before = edits.get(path)!.before;
        if (before === undefined) rmSync(path, { force: true });
        else {
          const temporary = `${path}.${randomUUID()}.tmp`;
          staged.set(path, temporary);
          writeFileSync(temporary, before, { mode: 0o600 });
          renameSync(temporary, path);
        }
      } catch (rollbackError) { failures.push(rollbackError); }
    }
    if (failures.length > 1) throw new AggregateError(failures, "Memory write failed and could not be fully rolled back.");
    throw error;
  } finally {
    for (const temporary of staged.values()) rmSync(temporary, { force: true });
  }
}
