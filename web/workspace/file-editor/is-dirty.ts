import type { OpenFile } from "../file-store/file-store-types.ts";

export const isDirty = (file: OpenFile | undefined) => Boolean(file) && file?.content !== file?.original;
