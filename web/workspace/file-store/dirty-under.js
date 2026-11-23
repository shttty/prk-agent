import { within } from "../file-paths/within.js";
import { isDirty } from "./is-dirty.js";
export const dirtyUnder = (ctx, root) => [...ctx.files.values()].some((file) => within(file.path, root) && isDirty(ctx, file));
