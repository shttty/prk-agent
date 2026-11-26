import { isDir } from "./is-dir.ts";
import type { DirEntry } from "./path-types.ts";

export const sortEntries = (entries: readonly DirEntry[] | null | undefined) => [...(entries || [])].sort((a, b) => (isDir(a) === isDir(b) ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) : isDir(a) ? -1 : 1));
