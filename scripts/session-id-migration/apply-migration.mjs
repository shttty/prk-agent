import { closeSync, openSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

export function applyMigration(changes) {
  const staged = [];
  const published = [];
  const removed = [];
  try {
    // Prepare every output before replacing any input. This is not a cross-file crash transaction.
    for (const change of changes) {
      const temporary = `${change.destination}.sessid-${randomUUID()}.tmp`;
      const descriptor = openSync(temporary, "wx");
      staged.push({ ...change, temporary });
      try { writeFileSync(descriptor, change.text); }
      finally { closeSync(descriptor); }
    }
    for (const change of staged) {
      renameSync(change.temporary, change.destination);
      published.push(change.destination);
    }
    for (const change of changes) {
      if (change.source === change.destination) continue;
      unlinkSync(change.source);
      removed.push(change.source);
    }
  } catch (error) {
    const cleanupFailures = [];
    for (const change of staged) {
      try { unlinkSync(change.temporary); }
      catch (cleanup) { if (cleanup.code !== "ENOENT") cleanupFailures.push(`${change.temporary}: ${cleanup.message}`); }
    }
    throw new Error(`Session-id migration write failed: ${error.message}\nPublished outputs: ${JSON.stringify(published)}\nRemoved old inputs: ${JSON.stringify(removed)}\n${published.length ? "The copy may be partially migrated; restore the controller's backup before retrying." : "No source files were changed."}${cleanupFailures.length ? `\nUnremoved temporary files: ${cleanupFailures.join("; ")}` : ""}`, { cause: error });
  }
  return { published, removed };
}
