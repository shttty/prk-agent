import type { DirectoryState } from "./directory-types.ts";

export const EMPTY_DIRECTORY: DirectoryState = { path: "", atRoot: false, entries: [], truncated: false, loading: false, error: "" };
