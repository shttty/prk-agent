import type { FileStoreContext } from "./file-store-types.ts";

export const get = (ctx: FileStoreContext, path: string) => ctx.files.get(path);
