import { stringify } from "smol-toml";
import { WireError } from "../../../gateway/wire/create-error.ts";
import type { MemoryStoreContext } from "../memory-types.ts";
import { commit } from "../batches/commit-files.ts";
import { defaultLayerDocument } from "./default-layers.ts";
import { mergeLayerOverride } from "./merge-layer-override.ts";
import { parseLayerSettings } from "./parse-layer-settings.ts";
import { configPath, contentHash, readLayerConfig, type LayerConfigFile, type LayerConfigView } from "./read-layer-config.ts";

const HEADER: Record<LayerConfigFile, string> = {
  shared: "# Shared memory layers for every host (PRK, pi-local-memory). Written by the PRK settings form; comments are not kept.\n# Layer order is authority order. Paths may use {instance} and {project}. Host changes go in <agent>-localmemory-override.toml.\n\n",
  override: "# PRK override of localmemory.toml. Written by the PRK settings form; comments are not kept.\n# Layers merge by name: listed fields replace, enabled = false drops a layer, new names are PRK-only layers.\n\n",
};

/**
 * Replaces one configuration file from the form. Refused when the file changed since `hash` was read, or when the
 * result would not parse for PRK (and, for the shared file, on its own for other hosts); nothing is written then.
 */
export function saveLayerConfig(ctx: MemoryStoreContext, file: LayerConfigFile, document: Record<string, unknown>, hash: string): LayerConfigView {
  const current = readLayerConfig(ctx, file);
  if (current.hash !== hash) throw new WireError("CONFLICT", "The configuration file changed since it was opened. Reload it before saving.");
  const shared = file === "shared" ? document : readLayerConfig(ctx, "shared").document ?? defaultLayerDocument(ctx.directory);
  const override = file === "override" ? document : readLayerConfig(ctx, "override").document;
  try {
    if (file === "shared") parseLayerSettings(document, ctx.home, ctx.directory);
    parseLayerSettings(override ? mergeLayerOverride(shared, override) : shared, ctx.home, ctx.directory);
  } catch (error) {
    throw new WireError("INVALID_REQUEST", `Configuration not saved: ${error instanceof Error ? error.message : String(error)}`);
  }
  let text: string;
  try { text = HEADER[file] + stringify(document); }
  catch (error) { throw new WireError("INVALID_REQUEST", `Configuration not saved: ${error instanceof Error ? error.message : String(error)}`); }
  commit(new Map([[configPath(ctx, file), { before: current.exists ? current.raw : undefined, after: text }]]));
  const saved = readLayerConfig(ctx, file);
  if (saved.hash !== contentHash(text)) throw new WireError("CONFLICT", "The configuration file changed while saving. Reload it.");
  return saved;
}
