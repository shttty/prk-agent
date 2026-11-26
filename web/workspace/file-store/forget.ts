import type { FileStoreContext } from "./file-store-types.ts";

export function forget(ctx: FileStoreContext, path: string) { if (ctx.files.delete(path)) ctx.emit(); }
