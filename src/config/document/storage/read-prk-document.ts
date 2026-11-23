import { readPrkDocumentSnapshot, type PrkDocumentFilename } from "./read-prk-document-snapshot.ts";

export async function readPrkDocument(path: string, filename: PrkDocumentFilename): Promise<Record<string, unknown> | undefined> {
  return (await readPrkDocumentSnapshot(path, filename)).document;
}
