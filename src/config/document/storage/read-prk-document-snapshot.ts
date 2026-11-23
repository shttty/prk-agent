import { readFile } from "node:fs/promises";
import { documentHash } from "./hash-prk-document.ts";
import { parsePrkDocument } from "./parse-prk-document.ts";

export type PrkDocumentFilename = "config.toml" | "instances.toml";
export interface PrkDocumentSnapshot {
  readonly exists: boolean;
  readonly raw: string;
  readonly hash: string;
  readonly document: Record<string, unknown> | undefined;
}

export async function readPrkDocumentSnapshot(path: string, filename: PrkDocumentFilename): Promise<PrkDocumentSnapshot> {
  const kind = filename === "config.toml" ? "PRK configuration" : "instance configuration";
  let source: string;
  try { source = await readFile(path, "utf8"); }
  catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { exists: false, raw: "", hash: "", document: undefined };
    throw new Error(`Unable to read ${kind} file.`);
  }
  return { exists: true, raw: source, hash: documentHash(source), document: parsePrkDocument(source, filename) };
}
