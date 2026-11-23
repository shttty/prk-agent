import { readPrkDocument } from "./storage/read-prk-document.ts";

/** Preserve every instance field during target edits. */
export function readPrkInstanceDocument(path: string): Promise<Record<string, unknown> | undefined> {
  return readPrkDocument(path, "instances.toml");
}
