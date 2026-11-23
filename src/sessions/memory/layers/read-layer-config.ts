import { createHash } from "node:crypto";
import { join } from "node:path";
import { parse } from "smol-toml";
import type { MemoryStoreContext } from "../memory-types.ts";
import { readRaw } from "../documents/read-document.ts";
import { SHARED_CONFIG_FILE, overrideConfigFile } from "./load-layer-settings.ts";

export type LayerConfigFile = "shared" | "override";

/** One configuration file as the settings form edits it; `hash` guards the save against concurrent edits. */
export interface LayerConfigView {
  readonly file: LayerConfigFile;
  readonly path: string;
  readonly exists: boolean;
  readonly raw: string;
  readonly hash: string;
  /** Parsed TOML, or null when absent or unparseable (`error` says why). */
  readonly document: Record<string, unknown> | null;
  readonly error?: string;
}

export const configPath = (ctx: MemoryStoreContext, file: LayerConfigFile): string =>
  join(ctx.directory, file === "shared" ? SHARED_CONFIG_FILE : overrideConfigFile(ctx.agent));

export const contentHash = (raw: string | undefined): string => raw === undefined ? "" : createHash("sha256").update(raw).digest("hex");

export function readLayerConfig(ctx: MemoryStoreContext, file: LayerConfigFile): LayerConfigView {
  const path = configPath(ctx, file);
  const raw = readRaw(path);
  const base = { file, path, exists: raw !== undefined, raw: raw ?? "", hash: contentHash(raw) };
  if (raw === undefined) return { ...base, document: null };
  try { return { ...base, document: parse(raw) as Record<string, unknown> }; }
  catch (error) { return { ...base, document: null, error: error instanceof Error ? error.message : String(error) }; }
}
