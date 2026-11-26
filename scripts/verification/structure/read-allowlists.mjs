import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/** Every allowlist entry as "scope rule path"; one file per scope, lines are `<rule> <path>`. */
export async function readAllowlists(dir) {
  const entries = [];
  for (const name of (await readdir(dir)).filter((file) => file.endsWith(".txt")).sort()) {
    const scope = name.slice(0, -4);
    const lines = (await readFile(path.join(dir, name), "utf8")).split("\n");
    for (const line of lines) {
      if (!line.trim() || line.startsWith("#")) continue;
      const [rule, file] = line.trim().split(/\s+/);
      entries.push({ scope, rule, file, source: `${name}` });
    }
  }
  return entries;
}
