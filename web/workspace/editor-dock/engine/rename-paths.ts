import type { EngineContext } from "./engine-types.ts";
import { renameChanges } from "../../editor-layout/rename-changes.ts";
import { baseName } from "../../file-paths/base-name.ts";

export function renamePaths(ctx: EngineContext, from: string, to: string) {
  const changes = renameChanges(ctx.panels(), from, to);
  for (const { id, path } of changes) {
    const panel = ctx.api.getPanel(id);
    panel?.api.updateParameters({ path });
    panel?.api.setTitle(baseName(path));
  }
  if (changes.length) ctx.emitChange();
}
