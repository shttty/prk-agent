import type { FileStoreContext, OpenFile } from "./file-store-types.ts";

export const isDirty = (_ctx: FileStoreContext, file: OpenFile | undefined) => Boolean(file) && file?.content !== file?.original;
