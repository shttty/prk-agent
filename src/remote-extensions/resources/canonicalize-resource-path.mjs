import { realpathSync } from "node:fs";

export function canonicalPath(path) {
  try { return realpathSync(path); } catch { return path; }
}
