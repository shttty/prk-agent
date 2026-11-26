import type { DirEntry } from "./path-types.ts";

export const isDir = (entry: Pick<DirEntry, "type"> | null | undefined) => entry?.type === "directory";
