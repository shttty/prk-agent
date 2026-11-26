import type { EngineContext } from "./engine-types.ts";
import { parseSavedLayout } from "../../editor-layout/parse-saved-layout.ts";
import { savedPaths } from "../../editor-layout/saved-paths.ts";

export function restore(ctx: EngineContext, raw: string) {
  const layout = parseSavedLayout(raw);
  if (!layout) return [];
  try { ctx.api.fromJSON(layout); } catch { ctx.api.clear(); return []; }
  return savedPaths(layout);
}
