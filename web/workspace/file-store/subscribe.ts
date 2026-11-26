import type { FileStoreContext } from "./file-store-types.ts";

export function subscribe(ctx: FileStoreContext, listener: () => void) { ctx.listeners.add(listener); return () => ctx.listeners.delete(listener); }
