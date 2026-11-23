import type { ToolLibraryEntry } from "./library-types.ts";

export function savedToolMetadata(entry: Pick<ToolLibraryEntry, "name" | "signature" | "docstring">) {
  return { name: `prk_saved_${entry.name}`, description: `Target-kernel Python tool ${entry.name}${entry.signature}. ${entry.docstring}` };
}
