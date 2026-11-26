import type { FileStoreContext } from "./file-store-types.ts";
import { isDirty } from "./is-dirty.ts";

export const isDirtyPath = (ctx: FileStoreContext, path: string) => isDirty(ctx, ctx.files.get(path));
