import { copyFileSync, constants, existsSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, chmodSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";

export function applyMigration(plan) {
  const staged = [];
  const published = [];
  try {
    for (const file of plan.files) {
      if (readFileSync(file.path, "utf8") !== file.before) throw new Error(`Migration input changed: ${file.path}`);
      if (existsSync(`${file.path}.before-plugins`)) throw new Error(`Backup already exists: ${file.path}.before-plugins`);
      const temporary = `${file.path}.plugins-${randomUUID()}.tmp`;
      writeFileSync(temporary, file.after, { flag: "wx", mode: file.mode ?? (statSync(file.path).mode & 0o777) });
      staged.push({ ...file, temporary });
    }
    for (const file of staged) {
      copyFileSync(file.path, `${file.path}.before-plugins`, constants.COPYFILE_EXCL);
      if (file.mode === 0o600) chmodSync(`${file.path}.before-plugins`, 0o600);
    }
    for (const file of staged) { renameSync(file.temporary, file.path); published.push(basename(file.path)); }
  } catch (error) {
    throw new Error(`Plugin migration failed: ${error.message}; published=${JSON.stringify(published)}. Inspect the owned copy and .before-plugins backups before retrying.`);
  } finally { for (const file of staged) rmSync(file.temporary, { force: true }); }
  return { home: plan.home, changed: published, unchanged: !published.length, packages: plan.packages.map(({ source, enabled, location }) => ({ source, enabled, location })) };
}
