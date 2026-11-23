import { readPrkDocumentSnapshot, type PrkDocumentSnapshot } from "./storage/read-prk-document-snapshot.ts";

export function readPrkConfigSnapshot(path: string): Promise<PrkDocumentSnapshot> {
  return readPrkDocumentSnapshot(path, "config.toml");
}
