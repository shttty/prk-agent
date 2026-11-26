import type { FileStoreContext } from "./file-store-types.ts";
import { baseName } from "../file-paths/base-name.ts";
import { fileKind } from "../file-paths/file-kind.ts";

export function ensure(ctx: FileStoreContext, path: string) {
  if (ctx.files.has(path)) return;
  ctx.files.set(path, { path, name: baseName(path), kind: fileKind(baseName(path)), view: "preview", content: "", original: "", loading: true });
  ctx.emit();
  void ctx.load(path);
}
