import { renameChanges } from "../../editor-layout/rename-changes.js";
import { baseName } from "../../file-paths/base-name.js";
export function renamePaths(ctx, from, to) {
      const changes = renameChanges(ctx.panels(), from, to);
      for (const { id, path } of changes) {
        const panel = ctx.api.getPanel(id);
        panel.api.updateParameters({ path });
        panel.api.setTitle(baseName(path));
      }
      if (changes.length) ctx.emitChange();
    }
