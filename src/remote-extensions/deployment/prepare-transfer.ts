import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import type { DeploymentArtifact } from "./deployment-types.ts";

const pending = new Map<string, Promise<{ path: string; size: number; gzip: boolean }>>();
export async function prepareTransfer(storeDir: string, asset: DeploymentArtifact): Promise<{ path: string; size: number; gzip: boolean }> {
  const source = join(storeDir, "store", asset.sha256);
  const handle = await open(source);
  const header = Buffer.alloc(6);
  try { await handle.read(header, 0, header.length, 0); } finally { await handle.close(); }
  // Existing gzip/xz archives are already transport-compressed; compression itself is always gzip -6.
  if (header[0] === 0x1f && header[1] === 0x8b || header.equals(Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0])) ) return { path: source, size: asset.size, gzip: false };
  const directory = join(storeDir, "transport-gzip");
  const path = join(directory, `${asset.sha256}.gz`);
  const existing = pending.get(path);
  if (existing) return existing;
  const work = (async () => {
    try { return { path, size: (await stat(path)).size, gzip: true }; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await mkdir(directory, { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await pipeline(createReadStream(source), createGzip({ level: 6 }), createWriteStream(temporary, { flags: "wx" }));
      await rename(temporary, path);
      return { path, size: (await stat(path)).size, gzip: true };
    } finally { await rm(temporary, { force: true }); }
  })();
  pending.set(path, work);
  try { return await work; } finally { pending.delete(path); }
}
