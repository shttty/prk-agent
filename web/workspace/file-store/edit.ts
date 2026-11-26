import type { FileStoreContext } from "./file-store-types.ts";

export const edit = (ctx: FileStoreContext, path: string, content: string) => ctx.patch(path, { content, saveError: "" });
