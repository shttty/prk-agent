import { readPrkDocumentSnapshot, type PrkDocumentSnapshot } from "./storage/read-prk-document-snapshot.ts";

export function readPrkInstanceSnapshot(path: string): Promise<PrkDocumentSnapshot> {
  return readPrkDocumentSnapshot(path, "instances.toml");
}
