import { within } from "../file-paths/within.js";
import { remapPath } from "../file-paths/remap-path.js";
import { baseName } from "../file-paths/base-name.js";
export function remap(ctx, from, to) {
      const moved = [...ctx.files.values()].filter((file) => within(file.path, from));
      if (!moved.length) return;
      for (const file of moved) ctx.files.delete(file.path);
      for (const file of moved) {
        const path = remapPath(file.path, from, to);
        ctx.files.set(path, { ...file, path, name: baseName(path) });
        if (ctx.restored.delete(file.path)) ctx.restored.add(path);
        // A read in flight for the old path lands nowhere: read again.
        if (file.loading) void ctx.load(path);
      }
      ctx.emit();
    }
