import type { FileStoreContext } from "./file-store-types.ts";

export const setView = (ctx: FileStoreContext, path: string, view: string) => ctx.patch(path, { view });
