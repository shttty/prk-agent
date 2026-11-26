import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { gatewayFixture, text } from "../../fixtures/gateway/assemble-gateway.mjs";
import { writeLoadProbe } from "../../fixtures/plugins/write-load-probe.mjs";

async function probeFixture(t, location, remote) {
  const root = await mkdtemp(join(tmpdir(), "probe-"));
  const probe = await writeLoadProbe(root);
  const f = await gatewayFixture(t, { remote, config: { session: { workerTools: "direct", noExtensions: false } }, settings: { packages: [{ source: probe.dir, enabled: true, location }] } });
  await f.stageArtifacts();
  const native = (sessionId, action, args = {}) => f.request("nativeAction", { sessionId, requestId: crypto.randomUUID(), action, args });
  const turn = async (sessionId, message) => assert.equal((await f.complete(sessionId, await f.send(sessionId, message))).status, "completed");
  // One plain turn, one tool call and one slash command; returns the markers they appended, the tool result and the command receipt.
  const exercise = async (sessionId) => {
    const before = (await probe.markers()).length;
    await turn(sessionId, "Plain turn");
    await turn(sessionId, `TOOL ${JSON.stringify({ name: probe.tool, args: {} })}`);
    const result = f.state(sessionId).messages.findLast((message) => message.role === "toolResult");
    const command = await f.send(sessionId, `/${probe.command}`);
    if (command.accepted) await f.complete(sessionId, command);
    await delay(300);
    return { result, command, markers: (await probe.markers()).slice(before) };
  };
  const catalog = async (sessionId) => (await native(sessionId, "capabilities")).data;
  return { f, probe, loadId: `load:package:${probe.dir}`, native, catalog, exercise };
}

const cases = [["gateway", false, "a Gateway package"], ["host", false, "a package on the local session host"], ["host", true, "a package on a remote session host"]];

// Each case boots its own Gateway; they run side by side to stay inside the integration budget.
test("a session that switches off a package loads none of its tools, hooks or commands, beside one that keeps it", { concurrency: true }, async (t) => {
  for (const [location, remote, label] of cases) {
    t.test(label, async (t) => {
      const { f, probe, loadId, native, catalog, exercise } = await probeFixture(t, location, remote);
      const [loads, skips] = [await f.create("loads"), await f.create("skips")];
      const first = await exercise(loads);
      assert.deepEqual(first.markers, ["before_agent_start", "agent_settled", "before_agent_start", "tool", "agent_settled", "command"]);
      assert.match(text(first.result), /probe ran/);
      assert.equal(first.command.accepted, true);

      assert.equal((await native(skips, "capabilities", { changes: [{ id: loadId, enabled: false }] })).status, "completed");
      assert.equal((await catalog(skips)).requiresReload, true, "a load switch applies on reload, like every package change");
      assert.equal((await native(skips, "reload")).status, "completed");
      const after = await catalog(skips);
      assert.equal(after.requiresReload, false);
      assert.deepEqual(after.packages.map(({ source, load }) => [source, load.enabled, load.overridden]), [[probe.dir, false, true]]);
      assert.deepEqual((await catalog(loads)).packages.map(({ load }) => [load.enabled, load.overridden]), [[true, false]]);

      const global = await f.request("capabilitiesList", { instance: f.target });
      assert(global.catalog.entries.some((entry) => entry.name === probe.tool), "the settings catalog still discovers every package's tools");
      if (location === "gateway") assert(after.entries.some((entry) => entry.name === probe.tool && entry.loaded === false), "the session lists them as not loaded");
      const skipped = await exercise(skips);
      assert.deepEqual(skipped.markers, [], "no hook, tool call or command of the package ran in the session that switched it off");
      assert.match(text(skipped.result), /not found/i, "its tool does not exist there");
      assert.match(skipped.command.error, /Unknown control input/, "its command does not exist there");

      const again = await exercise(loads);
      assert.equal(again.markers.length, 6, "the session that kept the package is unaffected");
      assert.match(text(again.result), /probe ran/);
    });
  }
});

test("the tool switch of a package still only hides its tools, and its hooks and commands keep running", async (t) => {
  const { f, probe, native, catalog, exercise } = await probeFixture(t, "gateway", false);
  const id = await f.create("tools off");
  assert.equal((await native(id, "capabilities", { changes: [{ id: `group:tools:package:${probe.name}`, enabled: false }] })).status, "completed");
  assert.equal((await native(id, "reload")).status, "completed");
  assert.equal((await catalog(id)).packages[0].load.enabled, true, "the package is still loaded");
  const ran = await exercise(id);
  assert.match(text(ran.result), /已关闭/, "the tool is registered but refused, unlike an unloaded package where it does not exist");
  assert.deepEqual(ran.markers, ["before_agent_start", "agent_settled", "before_agent_start", "agent_settled", "command"], "hooks and the command still run");
});
