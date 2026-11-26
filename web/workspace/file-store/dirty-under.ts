import { within } from "../file-paths/within.ts";
import { isDirty } from "./is-dirty.ts";
import type { FileStoreContext } from "./file-store-types.ts";
export const dirtyUnder = (ctx: FileStoreContext, root: string) => [...ctx.files.values()].some((file) => within(file.path, root) && isDirty(ctx, file));
