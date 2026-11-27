import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildDirectoryPackage } from "../../../src/remote-extensions/bundle/build-directory-package.ts";

const files = [{ path: "lib/a.js", size: 17, mode: 420 }, { path: "package.json", size: 73, mode: 420 }];
const shapes = {
  "npm 11 array": JSON.stringify([{ name: "probe-pkg", files }]),
  "npm 12 package-keyed object": JSON.stringify({ "probe-pkg": { name: "probe-pkg", files } }),
};

// A stand-in `npm` first on PATH prints the given pack output, so the check follows each npm major without installing it.
async function withNpmOutput(t, output) {
  const root = await mkdtemp(join(tmpdir(), "prk-pack-"));
  const bin = join(root, "bin");
  const plugin = join(root, "plugin");
  await mkdir(bin);
  await mkdir(join(plugin, "lib"), { recursive: true });
  await writeFile(join(plugin, "lib", "a.js"), "module.exports = 1;\n");
  await writeFile(join(plugin, "package.json"), "{}\n");
  await writeFile(join(root, "output.json"), output);
  await writeFile(join(bin, "npm"), `#!/bin/sh\nif [ "$1" = "--version" ]; then echo 99.1.0; else cat "${join(root, "output.json")}"; fi\n`);
  await chmod(join(bin, "npm"), 0o755);
  const path = process.env.PATH;
  process.env.PATH = `${bin}:${path}`;
  t.after(async () => { process.env.PATH = path; await rm(root, { recursive: true, force: true }); });
  return { store: { directory: join(root, "store") }, plugin };
}

for (const [name, output] of Object.entries(shapes)) {
  test(`a host plugin directory packed by ${name} output reaches the build step`, async (t) => {
    const { store, plugin } = await withNpmOutput(t, output);
    await assert.rejects(buildDirectoryPackage(store, plugin, true), (error) => error.code === "ENVIRONMENT_REQUIRED");
  });
}

test("an unrecognised npm pack output fails with the npm version and the output instead of marking the package unpackable", async (t) => {
  const { store, plugin } = await withNpmOutput(t, JSON.stringify({ unexpected: true }));
  await assert.rejects(buildDirectoryPackage(store, plugin, true), /Unrecognized npm pack output \(npm 99\.1\.0\) for .*plugin: \{"unexpected":true\}/);
});
