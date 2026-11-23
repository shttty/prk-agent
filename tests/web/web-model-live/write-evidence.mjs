import { lstat, mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export async function writeEvidence(ctx, name, value) {
  await writeFile(join(ctx.evidenceDir, name), `${JSON.stringify(value, null, 2)}\n`);
}
