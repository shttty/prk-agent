import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function normalizePattern(pattern) {
  if (pattern === "~") return homedir();
  if (pattern.startsWith("~/")) return join(homedir(), pattern.slice(2));
  return pattern.startsWith("file://") ? fileURLToPath(pattern) : pattern;
}
