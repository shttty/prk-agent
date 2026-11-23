import { mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync, readFileSync, existsSync, chmodSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { randomUUID } from "node:crypto";

export function applyMigration(plan) {
  const { home, changes, originals, preservation, pending } = plan;
  if (!changes.length) return { home, unchanged: true, pending, preservation };
  const backup = join(home, plan.backupName);
  if (existsSync(backup)) throw new Error(`Cutover backup already exists at ${backup}; restore it before resolving a partial migration`);
  const staged = [];
  const replaced = [];
  let backupComplete = false;
  try {
    for (const change of changes) {
      if (change.remove) continue;
      const temporary = `${change.path}.pienv-${randomUUID()}.tmp`;
      const fd = openSync(temporary, "wx", change.mode);
      staged.push({ ...change, temporary });
      try { writeFileSync(fd, change.text); fsyncSync(fd); }
      finally { closeSync(fd); }
      if (change.mode === 0o600) chmodSync(temporary, 0o600);
    }
    for (const [path, original] of originals) {
      const current = existsSync(path) ? readFileSync(path, "utf8") : "";
      if (current !== original) throw new Error(`File changed during migration preflight: ${relative(home, path)}`);
    }
    mkdirSync(backup);
    for (const [path, original] of originals) {
      if (!existsSync(path)) continue;
      const destination = join(backup, relative(home, path));
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, original, { flag: "wx", mode: path.endsWith("instances.toml") ? 0o600 : 0o666 });
    }
    writeFileSync(join(backup, "preservation.json"), JSON.stringify(preservation, null, 2) + "\n", { flag: "wx" });
    backupComplete = true;
    for (const change of staged) {
      renameSync(change.temporary, change.path);
      replaced.push(relative(home, change.path));
    }
    for (const change of changes.filter((change) => change.remove)) {
      unlinkSync(change.path);
      replaced.push(relative(home, change.path));
    }
  } catch (error) {
    for (const { temporary } of staged) {
      try { unlinkSync(temporary); } catch (cleanup) { if (cleanup.code !== "ENOENT") console.error(`Cannot remove own staging file ${temporary}`); }
    }
    const recovery = replaced.length
      ? `Restore ${backup} before retrying. Replaced: ${JSON.stringify(replaced)}.`
      : `No files replaced; originals were not changed by this migration.${backupComplete ? ` Complete backup: ${backup}.` : existsSync(backup) ? ` Incomplete backup: ${backup}; do not restore it.` : " No backup was created."}`;
    throw new Error(`Cutover failed; do not start Gateway. ${recovery} ${error.message}`, { cause: error });
  }
  return { home, backup, unchanged: false, replaced, pending, preservation };
}
