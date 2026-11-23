import assert from "node:assert/strict";
import { chmod, copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function prepareOutletFixture({ root, exists }) {
  const source = join(root, "plugin");
  await mkdir(source);
  await writeFile(join(source, "package.json"), JSON.stringify({ name: "@prk-tests/fileoutlet", version: "1.0.0", private: true,
    type: "module", files: ["index.js"], pi: { extensions: ["./index.js"] } }));
  await copyFile(new URL("../../fixtures/fileoutlet-plugin.mjs", import.meta.url), join(source, "index.js"));

  const targetRoot = join(root, "target-storage");
  const target = `/mnt/prk-fileoutlet-${process.pid}`;
  const targetCwd = `${target}/workspace`;
  const backingCwd = join(targetRoot, "workspace");
  const localCwd = join(root, "local-workspace");
  const gatewayCwd = join(root, "gateway-workspace");
  for (const path of [backingCwd, localCwd, gatewayCwd]) await mkdir(path, { recursive: true });
  assert.equal(await exists(target), false, "Target namespace must not exist on the Gateway");
  const files = { "replacement-read.txt": "KERNEL_PAGE_REMAINS_AUTHORITATIVE\n", "metadata.txt": "METADATA_FIRST\nMETADATA_SECOND\nMETADATA_THIRD\nMETADATA_FOURTH\n", "blocked.txt": "BLOCKED_ORIGINAL\n",
    "mutate.txt": "MUTATE_ORIGINAL\n", "diagnosed.txt": "DIAGNOSED_ORIGINAL\n", "formatted.txt": "FORMAT_ORIGINAL\nstable\n" };
  for (const [name, content] of Object.entries(files)) await writeFile(join(backingCwd, name), content);
  await writeFile(join(backingCwd, "large.txt"), "LARGE_OLD\n" + `${"x".repeat(127)}\n`.repeat(40960));
  const fileBytes = (await stat(join(backingCwd, "large.txt"))).size;
  assert(fileBytes >= 5 * 1024 * 1024);
  await writeFile(join(localCwd, "local.txt"), "LOCAL_ORIGINAL\n");
  await writeFile(join(gatewayCwd, "direct.txt"), "GATEWAY_SENTINEL\n");
  const wrapper = join(root, "target-shell");
  const q = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  await writeFile(wrapper, `#!/bin/bash\nexec bwrap --ro-bind / / --bind ${q(process.env.XDG_RUNTIME_DIR ?? "/tmp")} ${q(process.env.XDG_RUNTIME_DIR ?? "/tmp")} --bind ${q(root)} ${q(root)} --tmpfs /mnt --bind ${q(targetRoot)} ${q(target)} --dev /dev --proc /proc /bin/sh\n`);
  await chmod(wrapper, 0o700);


return { source, targetRoot, target, targetCwd, backingCwd, localCwd, gatewayCwd, wrapper, fileBytes, files, q };
}
