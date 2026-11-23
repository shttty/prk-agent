import { baseName } from "../file-paths/base-name.js";
import { fileKind } from "../file-paths/file-kind.js";
export function ensure(ctx, path) {
    if (ctx.files.has(path)) return;
    ctx.files.set(path, { path, name: baseName(path), kind: fileKind(baseName(path)), view: "preview", content: "", original: "", loading: true });
    ctx.emit();
    void ctx.load(path);
  }
