import type { FileStoreContext } from "./file-store-types.ts";

export const emit = (ctx: FileStoreContext) => { for (const listener of [...ctx.listeners]) listener(); };
