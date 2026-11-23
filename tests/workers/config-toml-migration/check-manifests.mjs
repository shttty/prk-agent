import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { scan } from "../../../src/codemode/module-payload/scan-kernel-modules.ts";

export async function checkManifests(root) {
  const directory = join(root, "kernel-tools");
  await mkdir(join(directory, "package"), { recursive: true });
  await writeFile(join(directory, "package", "__init__.py"), "VALUE = 1\n");
  await writeFile(join(directory, "package", "prk-tool.toml"), '[dependencies]\nbinaries = ["rg"]\n[[dependencies.python]]\nname = "example"\nversion = "1.0"\n');
  await writeFile(join(directory, "single.py"), "VALUE = 2\n");
  await writeFile(join(directory, "single.prk-tool.toml"), '[dependencies]\nbinaries = ["fd"]\n');
  await writeFile(join(directory, "plain.py"), "VALUE = 3\n");
  const modules = await scan(directory);
  assert.equal(modules.get("package").error, undefined);
  assert.deepEqual(modules.get("package").dependencies.binaries, ["rg"]);
  assert.equal(modules.get("package").dependencies.python[0].name, "example");
  assert.equal(modules.get("package").dependencies.python[0].version, "1.0");
  assert.deepEqual(modules.get("single").dependencies.binaries, ["fd"]);
  assert.deepEqual(modules.get("plain").dependencies, {});

  await writeFile(join(directory, "package", "prk-tool.json"), "{}");
  await writeFile(join(directory, "single.prk-tool.json"), "{}");
  for (const name of ["package", "single"]) {
    const module = (await scan(directory)).get(name);
    assert.match(module.error, /\.json.*rename.*\.toml/iu, "Legacy manifests are errors even alongside TOML");
    assert.deepEqual(module.dependencies, {}, "A legacy manifest must not be bypassed by the TOML manifest");
  }
  await mkdir(join(directory, "legacy"));
  await writeFile(join(directory, "legacy", "__init__.py"), "VALUE = 4\n");
  await writeFile(join(directory, "legacy", "prk-tool.json"), "{}");
  assert.match((await scan(directory)).get("legacy").error, /prk-tool\.json.*rename.*prk-tool\.toml/iu);
  await writeFile(join(directory, "invalid.py"), "VALUE = 5\n");
  await writeFile(join(directory, "invalid.prk-tool.toml"), "[dependencies\n");
  assert.equal(typeof (await scan(directory)).get("invalid").error, "string");
}
