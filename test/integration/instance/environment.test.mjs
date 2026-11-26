import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { stringify } from "smol-toml";
import { loadPrkConfig } from "../../../src/config/document/load-prk-config.ts";
import { gatewayFixture } from "../../fixtures/gateway/assemble-gateway.mjs";
import { until } from "../../fixtures/until.mjs";

test("session starts deploy an out-of-date environment once and refuse with DEPLOYMENT_FAILED when it fails", async (t) => {
  const f = await gatewayFixture(t, { config: { session: { workerTools: "direct", idleTimeoutMs: 1_000 } } });
  const collection = [];
  f.client.onCollectionEvent((event) => collection.push(event));
  const environments = () => collection.filter((event) => event.type === "target_environment_changed" && event.target === f.target).map((event) => event.details.environment);
  await f.request("subscribeSessions");
  const deployments = () => environments().filter((environment) => environment.status === "checking").length;
  // No rg/fd artifacts in the Gateway store yet: the automatic deployment really fails and creates nothing.
  await assert.rejects(f.create(), (error) => error.code === "DEPLOYMENT_FAILED" && error.details.environment.status === "failed");
  assert.equal(deployments(), 1);
  assert(!collection.some((event) => event.sessionId), "a failed deployment creates no session");
  await f.stageArtifacts();
  const ids = await Promise.all([f.create("A"), f.create("B")]);
  assert.equal(deployments(), 2, "two concurrent creates share one deployment");
  assert(environments().some((environment) => environment.status === "transferring" && environment.totalBytes > 0));
  assert.equal(environments().at(-1).status, "ready");
  for (const sessionId of ids) await until(async () => (await f.request("state", { sessionId })).state === "sleeping", "idle sleep");
  // The target lost one artifact while the sessions slept: only that one is sent again.
  const bin = join(f.root, "target", "bin");
  const [rg] = (await readdir(bin)).filter((sha) => existsSync(join(bin, sha, "rg")));
  await rm(join(bin, rg), { recursive: true });
  const woken = await Promise.all(ids.map((sessionId) => f.request("wakeSession", { sessionId })));
  assert.deepEqual(woken.map(({ sleeping }) => sleeping), [false, false]);
  assert.equal(deployments(), 3, "two concurrent wakes share one deployment");
  const woke = environments().at(-1);
  assert.equal(woke.status, "ready");
  assert(woke.totalBytes > 0 && woke.transferredBytes === woke.totalBytes, JSON.stringify(woke));
  assert(existsSync(join(bin, rg, "rg")));
  assert.equal((await f.complete(ids[0], await f.send(ids[0], "Target now ready"))).status, "completed");
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
