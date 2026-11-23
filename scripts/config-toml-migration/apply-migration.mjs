import { chmodSync, closeSync, fchmodSync, lstatSync, openSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";

export function applyMigration({ home, changes }) {
  const staged = [];
  const migrated = [];
  const backups = [];
  try {
    for (const change of changes) {
      const temporary = `${change.destination}.toml-migration-${randomUUID()}.tmp`;
      const descriptor = openSync(temporary, "wx", change.mode);
      staged.push({ ...change, temporary });
      try {
        writeFileSync(descriptor, change.text);
        if (change.mode === 0o600) fchmodSync(descriptor, 0o600);
      }
      finally { closeSync(descriptor); }
    }
    // All semantic checks precede staging. This is not a cross-file crash transaction.
    for (const change of staged) {
      for (const path of [change.backup, ...(change.source === change.destination ? [] : [change.destination])]) {
        try { lstatSync(path); }
        catch (error) { if (error.code === "ENOENT") continue; throw error; }
        throw new Error(`Occupied migration path: ${path}`);
      }
      renameSync(change.source, change.backup);
      backups.push(basename(change.backup));
      if (change.mode === 0o600) chmodSync(change.backup, 0o600);
      renameSync(change.temporary, change.destination);
      migrated.push(basename(change.destination));
    }
  } catch (error) {
    const unremoved = [];
    for (const { temporary } of staged) {
      try { unlinkSync(temporary); }
      catch (cleanup) { if (cleanup.code !== "ENOENT") unremoved.push(basename(temporary)); }
    }
    throw new Error(`Migration write failed: ${error.message}\nPublished outputs: ${JSON.stringify(migrated)}\nRenamed backups: ${JSON.stringify(backups)}${unremoved.length ? `\nUnremoved temporary files: ${JSON.stringify(unremoved)}` : ""}\nThe copy may be partially migrated; inspect these files before retrying.`);
  }
  return { home, migrated, backups, unchanged: changes.length === 0 };
}
