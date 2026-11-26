import { randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, readlinkSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { readSoul, type SoulText } from "./read-soul.ts";

/**
 * Replaces the soul file atomically when it still has `revision`. A symbolic link at `path` (or along a chain of
 * them) is kept: the new text replaces the file it finally points to, so the link keeps naming its authority.
 */
export function writeSoul(path: string, content: string, revision: string, maxBytes: number): SoulText {
  if (Buffer.byteLength(content, "utf8") > maxBytes) throw new WireError("INVALID_REQUEST", `The soul file is limited to ${maxBytes} bytes.`);
  if (readSoul(path).revision !== revision) throw new WireError("CONFLICT", "The soul file changed since it was opened. Reload it before saving.");
  const target = linkTarget(path);
  mkdirSync(dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, content, existingMode(target));
    renameSync(temporary, target);
  } finally {
    rmSync(temporary, { force: true });
  }
  return readSoul(path);
}

// Follows links by hand so a link whose target does not exist yet still names the file to create.
function linkTarget(path: string): string {
  let current = path;
  for (let hop = 0; hop < 40; hop++) {
    let link: boolean;
    try { link = lstatSync(current).isSymbolicLink(); }
    catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return current;
      throw error;
    }
    if (!link) return current;
    current = resolve(dirname(current), readlinkSync(current));
  }
  throw new WireError("INVALID_REQUEST", `Too many symbolic links at ${path}.`);
}

function existingMode(path: string): { mode?: number } {
  try { return { mode: statSync(path).mode & 0o777 }; }
  catch { return {}; }
}
