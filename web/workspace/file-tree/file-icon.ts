import { IMAGE_EXT } from "../file-paths/file-extensions.ts";
import { MARKDOWN_EXT } from "../file-paths/file-extensions.ts";
import { IconPhoto } from "@tabler/icons-react";
import { IconFileText } from "@tabler/icons-react";
import { IconFile } from "@tabler/icons-react";
export const fileIcon = (name: string) => (IMAGE_EXT.test(name) ? IconPhoto : MARKDOWN_EXT.test(name) ? IconFileText : IconFile);
