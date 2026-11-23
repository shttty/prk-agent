import { readFileSync, renameSync } from "node:fs";
import { documentHash } from "../../config/document/storage/hash-prk-document.ts";
import { WireError } from "../wire/create-error.ts";
import type { StagedConfig } from "./stage-config.ts";

/** Best-effort external-edit guard; hash comparison and atomic rename have no intervening await. */
export function publishConfig(path: string, staged: StagedConfig, expectedHash: string): void {
  let raw: string | undefined;
  try { raw = readFileSync(path, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (documentHash(raw) !== expectedHash) {
    throw new WireError("CONFLICT", "The configuration file changed since it was read. Reload it before saving.");
  }
  renameSync(staged.temporary, path);
}
