import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { stringify, parse } from "smol-toml";
import { loadPrkConfig } from "../../src/config/document/load-prk-config.ts";
import { readPrkConfigSnapshot } from "../../src/config/document/read-prk-config-snapshot.ts";
import { stageConfig } from "../../src/gateway/instances/stage-config.ts";
import { publishConfig } from "../../src/gateway/instances/publish-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";

const root = await mkdtemp(join(tmpdir(), "prk-toml-"));
const configPath = join(root, "config.toml");
const instancesPath = join(root, "instances.toml");
const run = promisify(execFile);
const main = fileURLToPath(new URL("../../src/main.ts", import.meta.url));
const special = "lazy:group:tools:package:<inline:kernel>";
let host;
try {
  for (const legacy of ["config.json", "instances.json"]) {
    await writeFile(join(root, legacy), "{}");
    await assert.rejects(loadPrkConfig(root), (error) => error.code === "INVALID_REQUEST" && error.message.includes("migrate-config-toml.mjs"));
    await assert.rejects(run(process.execPath, [main, "gateway", "--home", root, "--model", "offline/unavailable"], {
      env: { ...process.env, PRK_HOME: root }, timeout: 10000,
    }), (error) => error.code === 1 && error.stderr.includes(legacy) && error.stderr.includes("migrate-config-toml.mjs"));
    await rm(join(root, legacy));
  }
  await writeFile(configPath, "# operator comment\n" + stringify({
    session: { workerTools: "direct", capabilities: { [special]: true } },
    memory: { review: false }, monitor: { enabled: false }, derivation: { maxDepth: 4 },
  }));
  await writeFile(instancesPath, stringify({ instances: [] }), { mode: 0o600 });
  host = await createGatewayHost({ home: root, cwd: root, model: "offline/unavailable" });
  assert.equal(host.derivationGet().derivation.maxDepth, 4, "Host initialization retains configured derivation settings");
  await host.capabilitiesChange({ terminal: { yieldMs: 17 } });
  let raw = await readFile(configPath, "utf8");
  assert.match(raw, /^# .*Written by the PRK settings form; comments are not kept\.\n/);
  assert.equal(raw.includes("operator comment"), false);
  assert.equal(parse(raw).terminal.yieldMs, 17);
  assert.equal(parse(raw).session.capabilities[special], true);
  await host.derivationSet({ derivation: { maxDepth: 2 } });
  assert.equal((await loadPrkConfig(root)).derivation.maxDepth, 2);
  assert.equal((await loadPrkConfig(root)).session.capabilities[special], true);
  const target = { id: "local", label: "Local fixture", local: true, url: "http://127.0.0.1:1/", token: "owned-test-token", cwd: root };
  await host.addTarget({ target });
  await host.editTarget({ target: { ...target, label: "Edited fixture" } });
  const stored = parse(await readFile(instancesPath, "utf8")).instances[0];
  assert.equal(stored.label, "Edited fixture");
  assert.equal(stored.token, target.token);
  assert.deepEqual(stored.remoteExtensions, []);
  assert.equal((await stat(instancesPath)).mode & 0o777, 0o600);
  const beforeInvalid = await readFile(configPath, "utf8");
  await assert.rejects(host.capabilitiesChange({ terminal: { yieldMs: null } }), (error) => error.code === "INVALID_REQUEST");
  assert.equal(await readFile(configPath, "utf8"), beforeInvalid);
  // Exercise the same read/stage/publish implementation as every settings mutation, with a deterministic external edit.
  const snapshot = await readPrkConfigSnapshot(configPath);
  const staged = await stageConfig(configPath, { ...snapshot.document, terminal: { yieldMs: 18 } });
  raw = snapshot.raw + "\n# concurrent external edit\n";
  await writeFile(configPath, raw);
  try {
    assert.throws(() => publishConfig(configPath, staged, snapshot.hash), (error) => error.code === "CONFLICT");
    assert.equal(await readFile(configPath, "utf8"), raw, "Conflicting save preserves external bytes");
  } finally { await rm(staged.temporary, { force: true }); }
  assert.equal((await readdir(root)).some((name) => name.endsWith(".tmp")), false);
  console.log("PASS TOML config: legacy startup rejection, four real persistence paths, header, special keys, validation, hash CONFLICT and credential permissions");
} finally {
  try { await host?.close(); }
  finally { await rm(root, { recursive: true, force: true }); }
}
