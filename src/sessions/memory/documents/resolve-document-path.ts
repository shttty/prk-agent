import { WireError } from "../../../gateway/wire/create-error.ts";
import type { LayerScope, LayerSettings, LayerSpec } from "../layers/layer-types.ts";
import { resolveLayerPath } from "../layers/resolve-layer-path.ts";

/** The configured layer and its file for this scope; unknown layers and layers the scope lacks are refused. */
export function document(settings: LayerSettings, target: string, scope: LayerScope): { layer: LayerSpec; path: string } {
  const layer = settings.layers.find((item) => item.name === target);
  if (!layer) throw new WireError("INVALID_REQUEST", `Unknown memory target "${target}". Configured layers: ${settings.layers.map((item) => item.name).join(", ")}.`);
  let path: string | undefined;
  try { path = resolveLayerPath(layer, scope); }
  catch (error) { throw new WireError("INVALID_REQUEST", error instanceof Error ? error.message : String(error)); }
  if (path === undefined) throw new WireError("INVALID_REQUEST", `Memory layer "${target}" needs a project; this session has none.`);
  return { layer, path };
}
