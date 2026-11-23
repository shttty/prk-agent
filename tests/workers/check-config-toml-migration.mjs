import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPrkConfig } from "../../src/config/document/load-prk-config.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { readPrkDocument } from "../../src/config/document/storage/read-prk-document.ts";
import { checkPreflight } from "./config-toml-migration/check-preflight.mjs";
import { checkManifests } from "./config-toml-migration/check-manifests.mjs";

const root = await mkdtemp(join(tmpdir(), "prk-config-toml-migration-"));
const command = fileURLToPath(new URL("../../scripts/migrate-config-toml.mjs", import.meta.url));
const commandText = "ssh -T migration.example.test";
const capability = "lazy:group:tools:package:<inline:kernel>";
const config = {
  session: { capabilities: { [capability]: false } },
  kernelTools: { example: { "quoted.key:<>": "value", enabled: false, nested: { empty: {} }, values: [1, "two", true, [], {}] } },
};
const instances = { instances: [{ name: "fixture", label: "Fixture", sshCommand: commandText, cwd: root }] };

function run(args, env = {}) {
  const result = spawnSync(process.execPath, [command, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
  assert.equal(result.error, undefined);
  return result;
}

async function snapshot(home) {
  return Promise.all((await readdir(home)).sort().map(async (name) => {
    const path = join(home, name);
    const info = await stat(path);
    return [name, await readFile(path, "utf8"), info.mode, info.mtimeMs, info.ino];
  }));
}

try {
  const environmentHome = join(root, "environment-home");
  await mkdir(environmentHome);
  assert.notEqual(run([], { PRK_HOME: environmentHome }).status, 0, "--home is required even when PRK_HOME is set");
  const relative = run(["--home", "."], { PRK_HOME: environmentHome });
  assert.notEqual(relative.status, 0);
  assert.match(relative.stderr, /absolute/u);
  assert.deepEqual(await readdir(environmentHome), [], "Argument failures must not write environment-derived paths");

  const home = join(root, "normal");
  await mkdir(home);
  const sourceConfig = JSON.stringify(config, null, 2);
  const sourceInstances = JSON.stringify(instances, null, 2);
  await writeFile(join(home, "config.json"), sourceConfig);
  await writeFile(join(home, "instances.json"), sourceInstances, { mode: 0o644 });
  const migratedInstances = { instances: instances.instances.map(({ name, ...fields }) => ({ id: name, ...fields })) };
  const before = parsePrkConfig(config, migratedInstances);
  const result = run(["--home", home]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const summary = JSON.parse(result.stdout);
  assert.deepEqual(summary, {
    home, migrated: ["config.toml", "instances.toml"], backups: ["config.json.before-toml", "instances.json.before-toml"], unchanged: false,
  });
  assert(!result.stdout.includes(commandText), "JSON summary excludes configuration values");
  assert.deepEqual((await readdir(home)).sort(), ["config.json.before-toml", "config.toml", "instances.json.before-toml", "instances.toml"]);
  assert.equal(await readFile(join(home, "config.json.before-toml"), "utf8"), sourceConfig);
  assert.equal(await readFile(join(home, "instances.json.before-toml"), "utf8"), sourceInstances);
  assert.equal((await stat(join(home, "instances.toml"))).mode & 0o777, 0o600);
  assert.equal((await stat(join(home, "instances.json.before-toml"))).mode & 0o777, 0o600);
  assert.deepEqual(await readPrkDocument(join(home, "config.toml"), "config.toml"), config);
  assert.deepEqual(await readPrkDocument(join(home, "instances.toml"), "instances.toml"), migratedInstances);
  assert.deepEqual(await loadPrkConfig(home), before, "The real TOML loader preserves effective configuration semantics");
  assert.equal((await loadPrkConfig(home)).session.capabilities[capability], false);
  const migrated = await snapshot(home);
  const repeated = run(["--home", home]);
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.deepEqual(JSON.parse(repeated.stdout), { home, migrated: [], backups: [], unchanged: true });
  assert.deepEqual(await snapshot(home), migrated, "Re-running migration changes no bytes, permissions, inode, or timestamps");

  const empty = join(root, "empty");
  await mkdir(empty);
  const noInputs = run(["--home", empty]);
  assert.equal(noInputs.status, 0, noInputs.stderr);
  assert.equal(JSON.parse(noInputs.stdout).unchanged, true);
  assert.deepEqual(await readdir(empty), []);

  for (const filename of ["config", "instances"]) {
    const partial = join(root, `partial-${filename}`);
    await mkdir(partial);
    const other = filename === "config" ? "instances" : "config";
    const source = filename === "config" ? sourceConfig : sourceInstances;
    const existing = other === "config" ? "# Hand-written, keep me\n" : "# Hand-written, keep me\ninstances = []\n";
    await writeFile(join(partial, `${filename}.json`), source, { mode: 0o600 });
    await writeFile(join(partial, `${other}.toml`), existing, { mode: 0o600 });
    const existingStat = await stat(join(partial, `${other}.toml`));
    const mixed = run(["--home", partial]);
    assert.equal(mixed.status, 0, mixed.stderr);
    assert.deepEqual(JSON.parse(mixed.stdout).migrated, [`${filename}.toml`]);
    assert.equal(await readFile(join(partial, `${other}.toml`), "utf8"), existing);
    assert.equal((await stat(join(partial, `${other}.toml`))).mtimeMs, existingStat.mtimeMs);
    await loadPrkConfig(partial);
  }

  await checkPreflight(root, run);
  await checkManifests(root);
  console.log("PASS TOML migration: explicit home, whole-input no-write preflight, real semantic roundtrip, null paths, backups, credential modes, occupied paths, idempotence and module manifests");
} finally {
  await rm(root, { recursive: true, force: true });
}
