import type { FileStoreContext } from "./file-store-types.ts";

export function reloadOpen(ctx: FileStoreContext, paths: Iterable<string>) { for (const path of paths) if (ctx.files.has(path)) void ctx.load(path); }
