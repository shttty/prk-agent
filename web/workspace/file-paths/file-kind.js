import { IMAGE_EXT } from "./file-extensions.js";
import { MARKDOWN_EXT } from "./file-extensions.js";
export const fileKind = (name) => (IMAGE_EXT.test(name) ? "image" : MARKDOWN_EXT.test(name) ? "markdown" : "text");
