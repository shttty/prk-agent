import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export interface SoulText {
  readonly content: string;
  /** SHA-256 of the file text, "" when the file does not exist; a save must present the revision it edited. */
  readonly revision: string;
}

/** Reads through symbolic links; a missing file reads as empty. */
export function readSoul(path: string): SoulText {
  let raw: string;
  try { raw = readFileSync(path, "utf8"); }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return { content: "", revision: "" };
    throw error;
  }
  return { content: raw, revision: createHash("sha256").update(raw).digest("hex") };
}
