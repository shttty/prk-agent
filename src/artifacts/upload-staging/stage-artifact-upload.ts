import { randomUUID } from "node:crypto";
import { mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";
import { ArtifactError } from "../upload-error/create-artifact-error.ts";

/** HTTP only stages bytes; the Gateway remains the sole ArtifactStore manifest writer. */
export async function stageArtifactUpload(home: string, source: AsyncIterable<Uint8Array>, maxBytes: number): Promise<string> {
  const directory = join(home, "uploads");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, `upload-${randomUUID()}.tgz`);
  const file = await open(path, "wx", 0o600);
  let size = 0;
  try {
    for await (const chunk of source) {
      size += chunk.byteLength;
      if (size > maxBytes) throw new ArtifactError(413, "Upload exceeds the byte limit.");
      await file.writeFile(chunk);
    }
    await file.close();
    return path;
  } catch (error) {
    await file.close();
    await rm(path, { force: true });
    throw error;
  }
}
