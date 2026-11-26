import { IconFolder } from "@tabler/icons-react";
import { isDir } from "../file-paths/is-dir.ts";
import type { DirEntry } from "../file-paths/path-types.ts";
import { fileIcon } from "./file-icon.ts";
export const entryIcon = (entry: DirEntry) => (isDir(entry) ? IconFolder : fileIcon(entry.name));
