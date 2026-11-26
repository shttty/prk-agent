import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { gatewayFixture, text } from "../../fixtures/gateway/assemble-gateway.mjs";
import { writeLoadProbe } from "../../fixtures/plugins/write-load-probe.mjs";

async function probeFixture(t, probes, { remote = false, modelProviders } = {}) {
  const root = await mkdtemp(join(tmpdir(), "probe-"));
  const written = await Promise.all(probes.map(({ name }) => writeLoadProbe(root, name)));
  const owners = new Map(probes.flatMap(({ provider }, index) => provider ? [[provider, { source: written[index].dir, extensionPath: join(written[index].dir, "index.js") }]] : []));
  const f = await gatewayFixture(t, {
    remote, modelProviders: owners.size ? { owners, errors: [] } : modelProviders, config: { session: { workerTools: "direct", noExtensions: false } },
    settings: { packages: written.map(({ dir }, index) => ({ source: dir, enabled: true, location: probes[index].location })) },
  });
  await f.stageArtifacts();
  const native = (sessionId, action, args = {}) => f.request("nativeAction", { sessionId, requestId: crypto.randomUUID(), action, args });
  const turn = async (sessionId, message) => assert.equal((await f.complete(sessionId, await f.send(sessionId, message))).status, "completed");
  // One plain turn, one tool call and one slash command; returns the markers they appended, the tool result and the command receipt.
  const exercise = async (sessionId, probe) => {
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
  return { f, probes: written, loadId: (probe) => `load:package:${probe.dir}`, native, catalog, exercise };
}

const RAN = ["before_agent_start", "agent_settled", "before_agent_start", "tool", "agent_settled", "command"];

async function switchOff(ctx, sessionId, targets) {
  const { f, native, catalog, loadId } = ctx;
  const changes = targets.map((probe) => ({ id: loadId(probe), enabled: false }));
  assert.equal((await native(sessionId, "capabilities", { changes })).status, "completed");
  assert.equal((await catalog(sessionId)).requiresReload, true, "a load switch applies on reload, like every package change");
  assert.equal((await native(sessionId, "reload")).status, "completed");
  const after = await catalog(sessionId);
  assert.equal(after.requiresReload, false);
  return { f, after };
}

test("a session that switches off a Gateway or session-host package loads none of it, beside one that keeps it; tool switches and providers keep their meaning", async (t) => {
  const ctx = await probeFixture(t, [
    { name: "gwprobe", location: "gateway" }, { name: "hostprobe", location: "host" }, { name: "provprobe", location: "gateway", provider: "probe-provider" },
  ]);
  const { f, probes: [gw, host, prov], native, catalog, exercise, loadId } = ctx;
  const [loads, skips, toolsOff] = [await f.create("loads"), await f.create("skips"), await f.create("tools off")];
  for (const probe of [gw, host]) {
    const ran = await exercise(loads, probe);
    assert.deepEqual(ran.markers, RAN);
    assert.match(text(ran.result), /probe ran/);
    assert.equal(ran.command.accepted, true);
  }

  const { after } = await switchOff(ctx, skips, [gw, host]);
  assert.deepEqual(after.packages.map(({ source, load }) => [source, load.enabled, load.overridden]), [[gw.dir, false, true], [host.dir, false, true], [prov.dir, true, false]]);
  assert.deepEqual((await catalog(loads)).packages.map(({ load }) => [load.enabled, load.overridden]), [[true, false], [true, false], [true, false]]);
  assert(after.entries.some((entry) => entry.name === gw.tool && entry.loaded === false), "the session lists the skipped tools as not loaded");
  assert((await f.request("capabilitiesList", { instance: f.target })).catalog.entries.some((entry) => entry.name === gw.tool), "the settings catalog still discovers every package's tools");
  for (const probe of [gw, host]) {
    const skipped = await exercise(skips, probe);
    assert.deepEqual(skipped.markers, [], "no hook, tool call or command of the package ran in the session that switched it off");
    assert.match(text(skipped.result), /not found/i, "its tool does not exist there");
    assert.match(skipped.command.error, /Unknown control input/, "its command does not exist there");
    assert.equal((await exercise(loads, probe)).markers.length, 6, "the session that kept the package is unaffected");
  }

  // The tool switch only hides tools: the package stays loaded and its hooks and command keep running.
  assert.equal((await native(toolsOff, "capabilities", { changes: [{ id: `group:tools:package:${gw.name}`, enabled: false }] })).status, "completed");
  assert.equal((await native(toolsOff, "reload")).status, "completed");
  assert.equal((await catalog(toolsOff)).packages[0].load.enabled, true);
  const hidden = await exercise(toolsOff, gw);
  assert.match(text(hidden.result), /已关闭/, "the tool is registered but refused, unlike an unloaded package where it does not exist");
  assert.deepEqual(hidden.markers, ["before_agent_start", "agent_settled", "before_agent_start", "agent_settled", "command"]);

  // A package that owns a Gateway provider cannot be unloaded at any layer, and nothing is written.
  const refusal = (error) => error.code === "PROVIDER_POLICY" && /providers are shared by the whole Gateway/.test(error.message) && error.details.providerErrors[0].providerId === "probe-provider";
  await assert.rejects(f.request("capabilitiesChange", { instance: f.target, changes: [{ id: loadId(prov), enabled: false }] }), refusal);
  await assert.rejects(f.request("capabilitiesChange", { changes: [{ id: loadId(prov), enabled: false }] }), refusal);
  const { derivation } = await f.request("derivationGet");
  await assert.rejects(f.request("derivationSet", { derivation: { ...derivation, roles: { ...derivation.roles, small: { ...derivation.roles?.small, capabilities: { [loadId(prov)]: false } } } } }), refusal);
  const session = await native(loads, "capabilities", { changes: [{ id: loadId(prov), enabled: false }] });
  assert.equal(session.status, "failed");
  assert.match(session.message, /providers are shared by the whole Gateway/);
  assert.equal((await f.request("derivationGet")).derivation.roles?.small?.capabilities?.[loadId(prov)], undefined);
  assert.deepEqual((await catalog(loads)).packages.find(({ source }) => source === prov.dir).providerIds, ["probe-provider"]);
  await f.request("capabilitiesChange", { instance: f.target, changes: [{ id: loadId(gw), enabled: false }] });
  assert.deepEqual((await f.request("capabilitiesList", { instance: f.target })).catalog.packages.map(({ load }) => load.enabled), [false, true, true]);
});

test("a session that switches off a package on a remote session host never starts its extension there", async (t) => {
  const ctx = await probeFixture(t, [{ name: "remoteprobe", location: "host" }], { remote: true });
  const { f, probes: [probe], exercise } = ctx;
  const [loads, skips] = [await f.create("loads"), await f.create("skips")];
  const first = await exercise(loads, probe);
  assert.deepEqual(first.markers, RAN);
  assert.match(text(first.result), /probe ran/);
  await switchOff(ctx, skips, [probe]);
  const skipped = await exercise(skips, probe);
  assert.deepEqual(skipped.markers, []);
  assert.match(text(skipped.result), /not found/i);
  assert.match(skipped.command.error, /Unknown control input/);
  assert.equal((await exercise(loads, probe)).markers.length, 6);
});
