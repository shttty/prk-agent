import { readPrkDocument } from "./storage/read-prk-document.ts";

/** Preserve raw global settings without writing defaults during settings edits. */
export function readPrkConfigDocument(path: string): Promise<Record<string, unknown> | undefined> {
  return readPrkDocument(path, "config.toml");
}
