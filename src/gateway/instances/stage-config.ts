import { randomUUID } from "node:crypto";
import { chmod, mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { formatTomlDocument } from "../../config/document/storage/format-toml-document.ts";
import { WireError } from "../wire/create-error.ts";

export interface StagedConfig {
  readonly temporary: string;
  readonly text: string;
}

export async function stageConfig(path: string, document: object, mode?: number): Promise<StagedConfig> {
  let text: string;
  try {
    const kind = basename(path) === "instances.toml" ? "instances.toml" : "config.toml";
    text = formatTomlDocument(kind, document);
  } catch (error) {
    throw new WireError("INVALID_REQUEST", `Configuration not saved: ${error instanceof Error ? error.message : String(error)}`);
  }
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(temporary, text, { encoding: "utf8", flag: "wx", ...(mode === undefined ? {} : { mode }) });
    if (mode !== undefined) await chmod(temporary, mode);
    return { temporary, text };
  } catch {
    try { await unlink(temporary); } catch { /* best effort cleanup */ }
    throw new Error("Session configuration could not be staged; existing configuration retained.");
  }
}
