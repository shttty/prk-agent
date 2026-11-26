import type { FileStoreContext } from "./file-store-types.ts";
import { within } from "../file-paths/within.ts";

export function drop(ctx: FileStoreContext, root: string) {
  let changed = false;
  for (const path of [...ctx.files.keys()]) if (within(path, root)) { ctx.files.delete(path); ctx.restored.delete(path); changed = true; }
  if (changed) ctx.emit();
}
