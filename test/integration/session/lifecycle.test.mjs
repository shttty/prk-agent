import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { gatewayFixture } from "../../fixtures/gateway/assemble-gateway.mjs";
import { until } from "../../fixtures/until.mjs";

test("create → stream → stop → sleep → explicitly wake the same SDK session", async (t) => {
  const f = await gatewayFixture(t, {
    web: true,
    config: {
      session: {
        workerTools: "code", idleTimeoutMs: 800,
        capabilities: {
          "lazy:tool:session_list": true,
          "group:tools:package:<inline:kernel>": false,
        },
      },
      extensions: { deny: { tools: ["space_status"] } },
    },
    rate: 30,
    answer: () => fauxAssistantMessage("streamed words ".repeat(200)),
  });
  const directory = join(f.root, "agent", "skills", "reload-test");
  const skill = join(directory, "SKILL.md");
  const skillSource = "---\nname: reload-test\ndescription: Test skill registration.\n---\n\n# Reload test\n";
  await mkdir(directory, { recursive: true });
  await writeFile(skill, skillSource);
  const extensions = join(f.root, "agent", "extensions");
  await mkdir(extensions);
  await writeFile(join(extensions, "catalog-only.js"), `export default (pi) => pi.registerTool({
    name: "catalog_only", label: "Catalog only", description: "Discovered outside the worker loader",
    parameters: { type: "object", properties: {} },
    async execute() { return { content: [{ type: "text", text: "ok" }] }; },
  });`);
  await f.request("capabilitiesRefresh", {});
  await f.deploy();
  const collection = [];
  f.client.onCollectionEvent((event) => collection.push(event));
  await f.request("subscribeSessions", {});
  const create = await fetch(`${f.url}/api/sessions`, {
    method: "POST", headers: { Origin: f.url, "Content-Type": "application/json" },
    body: JSON.stringify({ target: f.target, cwd: f.cwd }),
  });
  assert.equal(create.status, 201, await create.clone().text());
  const { session, snapshot: created } = await create.json();
  const id = session.sessionId;
  assert.deepEqual(created.messages, []);
  assert.equal(created.toolMode, "code");
  const createdRow = await until(() => collection.find((event) => event.sessionId === id && event.type === "session_derivation_changed"), "new session row");
  const events = [];
  f.client.onEvent((event, sessionId) => { if (sessionId === id) events.push(event); });
  const initial = await f.request("subscribe", { sessionId: id });
  const receipt = await f.send(id, "Stream and stop");
  assert.equal(receipt.accepted, true, JSON.stringify(receipt));
  await until(() => events.find((event) => event.type === "message" && event.operationId === receipt.operationId && event.text), "stream delta");
  assert.equal((await f.request("cancel", { sessionId: id, operationId: receipt.operationId })).status, "requested");
  const done = await until(() => events.find((event) => event.type === "operation_completed" && event.operationId === receipt.operationId), "cancel settlement");
  assert.equal(done.details.status, "cancelled");
  const sleeping = await until(async () => {
    const state = await f.request("state", { sessionId: id });
    return state.state === "sleeping" && state;
  }, "sleeping after idle");
  assert.equal(sleeping.sessionId, id);
  assert.notEqual(sleeping.streamId, initial.streamId);
  assert.deepEqual(await f.request("wakeSession", { sessionId: id }), { sessionId: id, sleeping: false });
  const awake = await f.request("state", { sessionId: id });
  assert.equal(awake.state, "idle");

  const switched = await f.request("nativeAction", {
    sessionId: id, requestId: crypto.randomUUID(), action: "capabilities",
    args: { changes: [{ id: "tool:skill_read", enabled: false }] },
  });
  assert.equal(switched.status, "completed");
  const entry = (id) => switched.data.entries.find((entry) => entry.id === id);
  assert.equal(entry("tool:space_status")?.loaded, false, "denied extension tool stays unregistered");
  assert.equal(entry("tool:catalog_only")?.loaded, false, "worker filesystem extensions are disabled by default");
  assert.equal(entry("tool:session_list")?.lazy.enabled, true);
  assert.equal(entry("tool:session_list")?.loaded, true, "lazy tool stays registered");
  assert.equal(entry("tool:kernel_read")?.enabled, false);
  assert.equal(entry("tool:kernel_read")?.loaded, true, "group-disabled tool stays registered");
  assert.equal(entry("tool:skill_read")?.enabled, false);
  assert.equal(entry("tool:skill_read")?.loaded, true, "disabled tool stays registered");
  const switchEvent = await until(() => collection.find((event) => event.sessionId === id && event.type === "session_capabilities_changed"), "capability change event");
  const afterSwitch = await f.request("state", { sessionId: id });
  await writeFile(skill, `${skillSource}\nUpdated skill instructions.\n`);
  const afterEdit = await f.request("state", { sessionId: id });
  const editedCatalog = await f.request("nativeCapabilities", { sessionId: id });

  assert.deepEqual({
    createSnapshot: created.requiresReload,
    createRow: session.requiresReload,
    collectionRow: createdRow.details.session.requiresReload,
    fresh: initial.requiresReload,
    awake: awake.requiresReload,
    switchCatalog: switched.data.requiresReload,
    switchSnapshot: afterSwitch.requiresReload,
    switchEvent: switchEvent.details.requiresReload,
    edited: afterEdit.requiresReload,
    editedCatalog: editedCatalog.target.current.requiresReload,
  }, { createSnapshot: false, createRow: false, collectionRow: false, fresh: false,
    awake: false, switchCatalog: false, switchSnapshot: false, switchEvent: false, edited: true, editedCatalog: true });
});
