import { DEFAULT_TOOLS_OPTIONS, type ToolsOptions } from "./tools-options.ts";
import { parseLibraryOptions } from "./parse-library-options.ts";

export function parseToolsOptions(value: unknown): ToolsOptions {
  return parseLibraryOptions("tools", value, DEFAULT_TOOLS_OPTIONS);
}
