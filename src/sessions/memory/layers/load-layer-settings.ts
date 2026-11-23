import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "smol-toml";
import { defaultLayerDocument } from "./default-layers.ts";
import type { LayerSettings } from "./layer-types.ts";
import { mergeLayerOverride } from "./merge-layer-override.ts";
import { parseLayerSettings } from "./parse-layer-settings.ts";

export const SHARED_CONFIG_FILE = "localmemory.toml";
export const overrideConfigFile = (agent: string): string => `${agent}-localmemory-override.toml`;

/**
 * Reads `<directory>/localmemory.toml` (built-in defaults when absent) and the host's
 * `<directory>/<agent>-localmemory-override.toml` (optional). Read per call: edits take effect on the next session.
 */
export function loadLayerSettings(input: { directory: string; agent: string; home: string }): LayerSettings {
  const shared = readToml(join(input.directory, SHARED_CONFIG_FILE)) ?? defaultLayerDocument(input.directory);
  const override = readToml(join(input.directory, overrideConfigFile(input.agent)));
  return parseLayerSettings(override === undefined ? shared : mergeLayerOverride(shared, override), input.home, input.directory);
}

function readToml(path: string): Record<string, unknown> | undefined {
  let text: string;
  try { text = readFileSync(path, "utf8"); }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
  try { return parse(text) as Record<string, unknown>; }
  catch (error) { throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`); }
}
