import { readFileSync } from "node:fs";
import { join } from "node:path";
import { commit } from "../batches/commit-files.ts";

export function renameProjectRecord(directory: string, id: string, name: string): void {
  const path = join(directory, id, "project.json");
  const before = readFileSync(path, "utf8");
  const record = JSON.parse(before);
  if (record?.id !== id || typeof record.name !== "string") throw new Error(`Invalid project registry entry for ${id}.`);
  if (record.name !== name) commit(new Map([[path, { before, after: `${JSON.stringify({ ...record, name }, null, 2)}\n` }]]));
}
