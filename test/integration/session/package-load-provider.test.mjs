import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parse } from "smol-toml";
import { readFile } from "node:fs/promises";
import { gatewayFixture } from "../../fixtures/gateway/assemble-gateway.mjs";
import { writeLoadProbe } from "../../fixtures/plugins/write-load-probe.mjs";

test("a package that owns a Gateway provider cannot be switched off for an instance, a role or a session", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "probe-"));
  const owner = await writeLoadProbe(root, "providerpkg");
  const plain = await writeLoadProbe(root, "plainpkg");
  const modelProviders = { owners: new Map([["probe-provider", { source: owner.dir, extensionPath: join(owner.dir, "index.js") }]]), errors: [] };
  const f = await gatewayFixture(t, {
    config: { session: { workerTools: "direct", noExtensions: false } }, modelProviders,
    settings: { packages: [owner, plain].map(({ dir }) => ({ source: dir, enabled: true, location: "gateway" })) },
  });
  await f.stageArtifacts();
  const id = await f.create("session");
  const ownerId = `load:package:${owner.dir}`;
  const plainId = `load:package:${plain.dir}`;
  const refusal = (error) => error.code === "PROVIDER_POLICY" && /providers are shared by the whole Gateway/.test(error.message)
    && error.details.providerErrors[0].providerId === "probe-provider";

  await assert.rejects(f.request("capabilitiesChange", { instance: f.target, changes: [{ id: ownerId, enabled: false }] }), refusal);
  await assert.rejects(f.request("capabilitiesChange", { changes: [{ id: ownerId, enabled: false }] }), refusal);
  await assert.rejects(f.request("derivationGet").then(({ derivation }) => f.request("derivationSet", { derivation: { ...derivation, roles: { ...derivation.roles, small: { ...derivation.roles?.small, capabilities: { [ownerId]: false } } } } })), refusal);
  const session = await f.request("nativeAction", { sessionId: id, requestId: crypto.randomUUID(), action: "capabilities", args: { changes: [{ id: ownerId, enabled: false }] } });
  assert.equal(session.status, "failed");
  assert.match(session.message, /providers are shared by the whole Gateway/);

  // Nothing was written anywhere, and a package without providers switches off at the same layers.
  assert.equal(JSON.stringify(parse(await readFile(join(f.root, "instances.toml"), "utf8"))).includes(ownerId), false);
  assert.equal((await f.request("derivationGet")).derivation.roles?.small?.capabilities?.[ownerId], undefined);
  const catalog = (await f.request("nativeAction", { sessionId: id, requestId: crypto.randomUUID(), action: "capabilities" })).data;
  assert.deepEqual(catalog.packages.map(({ source, providerIds, load }) => [source, providerIds, load.enabled]), [[owner.dir, ["probe-provider"], true], [plain.dir, [], true]]);
  await f.request("capabilitiesChange", { instance: f.target, changes: [{ id: plainId, enabled: false }] });
  const listed = await f.request("capabilitiesList", { instance: f.target });
  assert.deepEqual(listed.catalog.packages.map(({ load }) => load.enabled), [true, false]);
});

test("a stored layer that already switches a provider package off fails session creation instead of being ignored", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "probe-"));
  const owner = await writeLoadProbe(root, "providerpkg");
  const modelProviders = { owners: new Map([["probe-provider", { source: owner.dir, extensionPath: join(owner.dir, "index.js") }]]), errors: [] };
  const f = await gatewayFixture(t, {
    config: { session: { workerTools: "direct", noExtensions: false, capabilities: { [`load:package:${owner.dir}`]: false } } }, modelProviders,
    settings: { packages: [{ source: owner.dir, enabled: true, location: "gateway" }] },
  });
  await f.stageArtifacts();
  await assert.rejects(f.create("refused"), (error) => error.code === "PROVIDER_POLICY" && /providers are shared by the whole Gateway/.test(error.message));
});
