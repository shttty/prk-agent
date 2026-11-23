import { within } from "../file-paths/within.js";
export function drop(ctx, root) {
      let changed = false;
      for (const path of [...ctx.files.keys()]) if (within(path, root)) { ctx.files.delete(path); ctx.restored.delete(path); changed = true; }
      if (changed) ctx.emit();
    }
