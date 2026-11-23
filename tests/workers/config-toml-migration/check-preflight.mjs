import assert from "node:assert/strict";
import { lstat, mkdir, readFile, readdir, readlink, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";

export async function checkPreflight(root, run) {
  let sequence = 0;
  async function inputs(config = "{}", instances = '{"instances":[]}') {
    const home = join(root, `preflight-${sequence++}`);
    await mkdir(home);
    await writeFile(join(home, "config.json"), config);
    await writeFile(join(home, "instances.json"), instances, { mode: 0o600 });
    return home;
  }
  async function snapshot(home) {
    return Promise.all((await readdir(home)).sort().map(async (name) => {
      const path = join(home, name);
      const info = await lstat(path);
      return [name, info.mode, info.mtimeMs, info.isSymbolicLink() ? await readlink(path) : info.isFile() ? await readFile(path, "utf8") : "directory"];
    }));
  }
  async function refuses(home, expected) {
    const before = await snapshot(home);
    const result = run(["--home", home]);
    assert.notEqual(result.status, 0, "Invalid inputs must fail migration");
    assert.match(result.stderr, expected);
    assert.equal(result.stdout, "", "Failures must not publish a success summary");
    assert.deepEqual(await snapshot(home), before, "Every preflight failure leaves every input and occupied path untouched");
  }

  for (const [config, instances, path] of [
    ["null", '{"instances":[]}', /config\.json is null/u],
    ['{"session":null}', '{"instances":[]}', /config\.json\.session is null/u],
    ['{"kernelTools":{"example":{"nested":[{"value":null}]}}}', '{"instances":[]}', /config\.json\.kernelTools\.example\.nested\[0\]\.value is null/u],
    ['{"kernelTools":{"example":{"odd.key":[null]}}}', '{"instances":[]}', /config\.json\.kernelTools\.example\["odd\.key"\]\[0\] is null/u],
    ["{}", '{"instances":[null]}', /instances\.json\.instances\[0\] is null/u],
  ]) await refuses(await inputs(config, instances), path);

  const lossy = '{"kernelTools":{"example":{"signedZero":-0}}}';
  parsePrkConfig(JSON.parse(lossy), { instances: [] });
  await refuses(await inputs(lossy), /roundtrip changes values/u);
  await refuses(await inputs("{}", '{"instances":[{"token":"do-not-print-this-token"}]}'), /validation/u);
  await refuses(await inputs("{}", '{"instances":['), /not readable JSON/u);

  for (const filename of ["config.toml", "instances.toml", "config.json.before-toml", "instances.json.before-toml"]) {
    const home = await inputs();
    await writeFile(join(home, filename), "occupied contents\n");
    await refuses(home, /occupied path/u);
  }
  const directory = await inputs();
  await mkdir(join(directory, "instances.toml"));
  await refuses(directory, /occupied path/u);
  const dangling = await inputs();
  await symlink("missing-target", join(dangling, "instances.json.before-toml"));
  await refuses(dangling, /occupied path/u);
}
