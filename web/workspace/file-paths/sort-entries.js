import { isDir } from "./is-dir.js";
export const sortEntries = (entries) => [...(entries || [])].sort((a, b) => (isDir(a) === isDir(b) ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) : isDir(a) ? -1 : 1));
