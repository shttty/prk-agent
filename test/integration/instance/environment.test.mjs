import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { stringify } from "smol-toml";
import { loadPrkConfig } from "../../../src/config/document/load-prk-config.ts";
import { gatewayFixture } from "../../fixtures/gateway/assemble-gateway.mjs";

test("instance deployment emits progress and readies a previously unavailable target", async (t) => {
  const f = await gatewayFixture(t);
  const events = [];
  f.client.onCollectionEvent((event) => events.push(event));
  await f.request("subscribeSessions");
  assert.equal((await f.request("getTargetEnvironment", { target: f.target })).status, "idle");
  await assert.rejects(f.create(), { code: "ENVIRONMENT_REQUIRED" });
  const ready = await f.deploy();
  assert.equal(ready.percent, 100);
  const statuses = events.filter((event) => event.type === "target_environment_changed" && event.target === f.target).map((event) => event.details.environment.status);
  assert(statuses.includes("checking"));
  assert(statuses.includes("ready"));
  const id = await f.create();
  assert.equal((await f.complete(id, await f.send(id, "Target now ready"))).status, "completed");
});

test("offline name→id conversion preserves original bytes in the private backup and reloads", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "id-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  const path = join(home, "instances.toml");
  const original = stringify({ instances: [{ name: "loopback", label: "Label differs from identifier", cwd: home, local: true }] });
  await writeFile(path, original, { mode: 0o600 });
  await assert.rejects(loadPrkConfig(home), /replace the removed name field with id/);
  const command = fileURLToPath(new URL("../../../scripts/migrate-pienv.mjs", import.meta.url));
  const run = () => promisify(execFile)(process.execPath, [command, "--home", home, "--gateway-stopped"]);
  const result = JSON.parse((await run()).stdout);
  assert.deepEqual(result.replaced, ["instances.toml"]);
  const backup = join(result.backup, "instances.toml");
  assert.equal(await readFile(backup, "utf8"), original);
  assert.equal((await stat(backup)).mode & 0o777, 0o600);
  const [target] = (await loadPrkConfig(home)).instances;
  assert.deepEqual([target.id, target.kernel.target, target.label], ["loopback", "loopback", "Label differs from identifier"]);
  assert.equal(JSON.parse((await run()).stdout).unchanged, true);
});
