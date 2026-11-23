import { IconFolder } from "@tabler/icons-react";
import { isDir } from "../file-paths/is-dir.js";
import { fileIcon } from "./file-icon.js";
export const entryIcon = (entry) => (isDir(entry) ? IconFolder : fileIcon(entry.name));
