import { randomUUID } from "node:crypto";
import { existsSync, linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Register once and return the authoritative creation date from the shared project file. */
export function ensureProjectRecord(projectsDirectory: string, id: string, name: string, created: string): string | undefined {
  if (!id.trim() || id === "." || id === ".." || /[\\/\p{Cc}]/u.test(id)) throw new Error(`Invalid project id ${JSON.stringify(id)}.`);
  const directory = join(projectsDirectory, id);
  const file = join(directory, "project.json");
  if (existsSync(file)) return readCreated(file);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const record = { id, name, created, archived: false };
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
    // linkSync publishes atomically and, unlike rename, refuses to replace an existing record.
    try { linkSync(temporary, file); }
    catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) throw error; }
  } finally {
    rmSync(temporary, { force: true });
  }
  return readCreated(file);
}

function readCreated(path: string): string | undefined {
  const { created } = JSON.parse(readFileSync(path, "utf8"));
  return typeof created === "string" && Number.isFinite(Date.parse(created)) ? created : undefined;
}
