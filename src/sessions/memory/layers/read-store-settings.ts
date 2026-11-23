import { WireError } from "../../../gateway/wire/create-error.ts";
import type { MemoryStoreContext } from "../memory-types.ts";
import type { LayerSettings } from "./layer-types.ts";
import { loadLayerSettings } from "./load-layer-settings.ts";

const reported = new Set<string>();

/** Layer settings for one store call; a broken TOML file disables memory with the reason, logged once per message. */
export function readStoreSettings(ctx: MemoryStoreContext): LayerSettings {
  try {
    return loadLayerSettings({ directory: ctx.directory, agent: ctx.agent, home: ctx.home });
  } catch (error) {
    const message = `Memory configuration is invalid: ${error instanceof Error ? error.message : String(error)}`;
    if (!reported.has(message)) {
      reported.add(message);
      console.error(`[${new Date().toISOString()}] ${message}`);
    }
    throw new WireError("INVALID_REQUEST", message);
  }
}
