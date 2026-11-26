import { IMAGE_EXT } from "./file-extensions.ts";
import { MARKDOWN_EXT } from "./file-extensions.ts";
export const fileKind = (name: string) => (IMAGE_EXT.test(name) ? "image" : MARKDOWN_EXT.test(name) ? "markdown" : "text");
