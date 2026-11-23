import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify, parse } from "smol-toml";
import { loadPrkConfig } from "../../src/config/document/load-prk-config.ts";

const home = mkdtempSync(join(tmpdir(), "prk-instance-id-"));
const instancesPath = join(home, "instances.toml");
const configPath = join(home, "config.toml");
const oldBackup = join(home, "before-pienv");
const newBackup = join(home, "before-instance-id");
const command = fileURLToPath(new URL("../../scripts/migrate-pienv.mjs", import.meta.url));
const run = () => spawnSync(process.execPath, [command, "--home", home, "--gateway-stopped"], {
  encoding: "utf8", env: { ...process.env, PRK_HOME: home },
});
const privateMode = (path) => statSync(path).mode & 0o777;
const read = (path) => readFileSync(path, "utf8");

try {
  const oldInstance = { name: "default", label: "家里", cwd: "/home/local", tags: ["home"], local: true,
    customMetrics: [{ name: "temperature", command: "printf 42", interval_s: 5, parse: "number" }] };
  const newInstance = { id: "office", label: "办公室", cwd: "/work", sshCommand: "ssh -T office" };
  const original = stringify({ instances: [oldInstance, newInstance] });
  const config = "# unchanged global config\n";
  const control = '{"rootSessionId":null}\n';
  writeFileSync(configPath, config);
  writeFileSync(join(home, "session-control.json"), control);
  const sessionId = randomUUID();
  const timestamp = new Date().toISOString();
  const sessions = join(home, "sessions");
  mkdirSync(sessions);
  const historyPath = join(sessions, `${sessionId}.jsonl`);
  const history = [
    { type: "session", version: 3, id: sessionId, cwd: "/home/local", timestamp },
    { type: "custom", id: "creation", parentId: null, timestamp, customType: "gateway-session-binding",
      data: { version: 4, sessionId, target: "default", cwd: "/home/local" } },
    { type: "session_info", id: "title", parentId: "creation", timestamp, name: "Owned binding" },
  ].map((entry) => JSON.stringify(entry) + "\n").join("");
  writeFileSync(historyPath, history);
  mkdirSync(oldBackup);
  writeFileSync(join(oldBackup, "preservation.json"), "[]\n");

  const mixed = stringify({ instances: [{ ...oldInstance, id: "default" }] });
  writeFileSync(instancesPath, mixed, { mode: 0o600 });
  const refused = run();
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /both name and id/);
  assert.equal(read(instancesPath), mixed);
  assert(!readdirSync(home).includes("before-instance-id"));

  writeFileSync(instancesPath, original);
  await assert.rejects(loadPrkConfig(home), /replace the removed name field with id/);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).replaced, ["instances.toml"]);
  const backup = join(newBackup, "instances.toml");
  assert.equal(read(backup), original);
  assert.equal(privateMode(backup), 0o600);
  assert.equal(privateMode(instancesPath), 0o600);
  assert.equal(read(configPath), config);
  assert.equal(read(join(home, "session-control.json")), control);
  assert.equal(read(historyPath), history);
  assert.equal(read(join(oldBackup, "preservation.json")), "[]\n");
  const { name, ...fields } = oldInstance;
  assert.deepEqual(structuredClone(parse(read(instancesPath))), { instances: [{ id: name, ...fields }, newInstance] });
  assert.deepEqual((await loadPrkConfig(home)).instances.map(({ id, kernel }) => [id, kernel.target]), [["default", "default"], ["office", "office"]]);

  const published = read(instancesPath);
  const repeated = run();
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.equal(JSON.parse(repeated.stdout).unchanged, true);
  assert.equal(read(instancesPath), published);
  assert.equal(read(backup), original);
  console.log("PASS instance id migration: legacy/new entries, conflict refusal, existing pi-env backup, private backup, unchanged bindings, and idempotence");
} finally {
  rmSync(home, { recursive: true, force: true });
}
