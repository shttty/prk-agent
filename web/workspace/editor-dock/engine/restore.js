import { parseSavedLayout } from "../../editor-layout/parse-saved-layout.js";
import { savedPaths } from "../../editor-layout/saved-paths.js";
export function restore(ctx, raw) {
      const layout = parseSavedLayout(raw);
      if (!layout) return [];
      try { ctx.api.fromJSON(layout); } catch { ctx.api.clear(); return []; }
      return savedPaths(layout);
    }
