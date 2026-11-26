import type { FileStoreContext } from "./file-store-types.ts";

export function markRestored(ctx: FileStoreContext, paths: Iterable<string>) { for (const path of paths) ctx.restored.add(path); }
