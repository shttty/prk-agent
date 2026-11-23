import { execFile } from "node:child_process";
import { opendir, open, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);
const order = new Intl.Collator("en", { numeric: true });

export async function measureGlibc(archive) {
  const scratch = await mkdtemp(join(tmpdir(), "prk-pbs-"));
  try {
    await run("tar", ["-xzf", archive, "-C", scratch]);
    let maximum;
    const header = Buffer.alloc(4);
    const directory = await opendir(scratch, { recursive: true });
    for await (const entry of directory) {
      if (!entry.isFile()) continue;
      const file = join(entry.parentPath, entry.name);
      const handle = await open(file);
      try { if ((await handle.read(header, 0, 4, 0)).bytesRead !== 4 || !header.equals(elf)) continue; }
      finally { await handle.close(); }
      const { stdout } = await run("objdump", ["-T", file], { maxBuffer: 16 * 1024 * 1024 });
      for (const [, version] of stdout.matchAll(/^.*\*UND\*.*\bGLIBC_(\d+(?:\.\d+)+)\b/gm)) {
        if (!maximum || order.compare(maximum, version) < 0) maximum = version;
      }
    }
    if (!maximum) throw new Error("The pinned Python archive has no required GLIBC symbols.");
    return maximum;
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
