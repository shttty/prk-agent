import type { MemoryStoreContext } from "../memory-types.ts";
import type { LayerScope } from "../layers/layer-types.ts";
import { MEMORY_ENTRY_DELIMITER } from "../memory-constants.ts";
import { readStoreSettings } from "../layers/read-store-settings.ts";
import { resolveLayerPath } from "../layers/resolve-layer-path.ts";
import { entries as parseEntries } from "./parse-entries.ts";
import { readRaw } from "./read-document.ts";
import { usage as measureUsage } from "../capacity/measure-usage.ts";
import { number } from "../capacity/format-count.ts";

/** Every present layer in configured order; a misconfigured or disabled store renders nothing. */
export function render(ctx: MemoryStoreContext, scope: LayerScope & { projectName?: string }): string {
  if (!ctx.enabled) return "";
  let settings;
  try { settings = readStoreSettings(ctx); } catch { return ""; }
  return settings.layers.flatMap((layer) => {
    const path = resolveLayerPath(layer, scope);
    if (path === undefined) return [];
    const entries = parseEntries(readRaw(path));
    if (!entries.length) return [];
    const usage = measureUsage(layer, entries, scope);
    const qualifier = usage.instance ?? (usage.project === undefined ? undefined : scope.projectName ?? usage.project);
    const title = `${layer.name.toUpperCase()}${qualifier === undefined ? "" : ` — ${qualifier}`} — ${layer.description}`;
    const separator = "═".repeat(46);
    return [`${separator}\n${title} [${Math.floor(usage.chars / usage.limit * 100)}% — ${number(usage.chars)}/${number(usage.limit)} chars]\n${separator}\n${entries.join(MEMORY_ENTRY_DELIMITER)}`];
  }).join("\n\n");
}
