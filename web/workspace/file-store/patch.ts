import type { FileChanges, FileStoreContext } from "./file-store-types.ts";

export const patch = (ctx: FileStoreContext, path: string, changes: FileChanges) => {
  const file = ctx.files.get(path);
  if (!file) return;
  ctx.files.set(path, { ...file, ...(typeof changes === "function" ? changes(file) : changes) });
  ctx.emit();
};
