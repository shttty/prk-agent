import assert from "node:assert/strict";

const shape = ({ id, parentId, timestamp, ...entry }) => entry.type === "custom" && entry.customType === "gateway-native-session-state"
  ? { ...entry, data: Object.fromEntries(Object.entries(entry.data).map(([key, value]) => [key,
    ["autoCompaction", "autoRetry"].includes(key) ? typeof value : value])) }
  : entry;
const changes = [
  ["model", { model: "sleepset/alternate" }],
  ["thinking", { level: "high" }],
  ["tool-mode", { mode: "direct" }],
  ["delegation", { level: "eager" }],
  ["local-tools", { enabled: true }],
  ["capabilities", { changes: [{ id: "tool:ask", enabled: false }] }],
  ["scoped-models", { models: ["sleepset/alternate", "sleepset/primary"] }],
];

export async function checkSleepingSettings(f, { sleeping, awake }) {
  const initial = await f.state(sleeping), calls = f.provider.requests.length, kernels = await f.kernels();
  const catalog = await f.request("nativeCapabilities", { sessionId: sleeping });
  for (const [name] of changes) assert.equal(catalog.actions.find((entry) => entry.name === name)?.enabled, true, `${name} is available asleep`);
  const candidates = catalog.commands.find(({ name }) => name === "model").arguments.find(({ name }) => name === "model").candidates;
  assert(candidates.some(({ value, available }) => value === "sleepset/alternate" && available !== false), "Sleeping catalog contains available native model choices");
  const rejections = [];
  for (const sessionId of [awake, sleeping]) {
    const before = await f.entries(sessionId);
    const reasons = [];
    for (const [name, args] of [["model", { model: "sleepset/absent" }], ["model", { model: "sleepset-no-auth/controlled" }], ["thinking", { level: "xhigh" }], ["thinking", { level: "not-a-level" }]]) {
      const result = await f.action(sessionId, name, args);
      assert.equal(result.status, "failed", `${sessionId}: ${JSON.stringify(result)}`);
      assert(result.message.length > 0);
      reasons.push(result.message);
      assert.deepEqual(await f.entries(sessionId), before, "Invalid model/thinking never appends history");
    }
    rejections.push(reasons);
  }
  assert.deepEqual(rejections[0], rejections[1], "Awake and sleeping validation share the same rejection semantics");
  for (const [name, args] of [["compact", {}], ["reload", {}], ["export", { format: "jsonl" }], ["tree-label", { entryId: initial.messageEntryIds.find(Boolean), label: "asleep-label" }]]) {
    const descriptor = catalog.actions.find((entry) => entry.name === name);
    assert.equal(descriptor?.enabled, false, `${name} still requires a live runtime`);
    assert.equal(typeof descriptor.reason, "string");
    const refused = await f.action(sleeping, name, args);
    assert.equal(refused.status, name === "tree-label" ? "failed" : "unavailable", `${name} cannot implicitly wake`);
    assert.equal(refused.data?.executed, false, `${name} explicitly reports no execution`);
    assert.equal((await f.state(sleeping)).state, "sleeping", `${name} leaves the session asleep`);
  }
  await f.request("subscribe", { sessionId: sleeping });
  const shapes = {};
  for (const [name, args] of changes) {
    const asleepBefore = await f.entries(sleeping), awakeBefore = await f.entries(awake);
    const pushedAfter = f.events.length;
    const data = await f.change(sleeping, name, args);
    const fields = name === "model" ? { model: "sleepset/alternate" } : name === "thinking" ? { thinkingLevel: "high" }
      : name === "tool-mode" ? { toolMode: "direct" } : name === "delegation" ? { delegation: "eager" } : {};
    await f.until(() => f.events.slice(pushedAfter).some(({ sessionId, event }) => sessionId === sleeping && event.type === "snapshot"
      && event.details?.snapshot?.state === "sleeping" && Object.entries(fields).every(([key, value]) => event.details.snapshot[key] === value)), `${name} pushes the authoritative sleeping snapshot`);
    await f.change(awake, name, args);
    const added = (await f.entries(sleeping)).slice(asleepBefore.length).map(shape);
    const awakeAdded = (await f.entries(awake)).slice(awakeBefore.length).map(shape);
    assert(added.length > 0, `${name} appends real SDK entries`);
    assert.deepEqual(added, awakeAdded, `${name} uses exactly the awake entry shape, with no pending-setting storage`);
    if (name === "model") {
      assert.deepEqual(data, { model: "sleepset/alternate", thinkingLevel: "off" });
      assert(added.some((entry) => entry.type === "model_change" && entry.provider === "sleepset" && entry.modelId === "alternate"));
    } else if (name === "thinking") assert(added.some((entry) => entry.type === "thinking_level_change" && entry.thinkingLevel === "high"));
    else {
      const expected = name === "tool-mode" ? { version: 1, toolMode: "direct" }
        : name === "delegation" ? { version: 1, delegation: "eager" }
          : name === "local-tools" ? { version: 1, localTools: true }
            : name === "capabilities" ? { version: 1, capabilities: { "tool:ask": false } } : undefined;
      if (expected) assert.deepEqual(added, [{ type: "custom", customType: "gateway-native-session-state", data: expected }]);
      else assert.deepEqual(added.at(-1).data.models, ["sleepset/alternate", "sleepset/primary"]);
    }
    const snapshot = await f.state(sleeping);
    assert.equal(snapshot.state, "sleeping", `${name} never wakes`);
    assert.equal(snapshot.streamId, initial.streamId, `${name} keeps the dormant stream`);
    assert.deepEqual(snapshot.messages, initial.messages, `${name} does not admit input`);
    shapes[name] = added;
  }
  await f.until(() => f.events.some(({ sessionId, event }) => sessionId === sleeping && event.type === "snapshot"
    && event.details?.snapshot?.model === "sleepset/alternate" && event.details.snapshot.thinkingLevel === "high"), "settings push authoritative snapshot");
  const snapshot = await f.state(sleeping);
  assert.equal(snapshot.model, "sleepset/alternate");
  assert.equal(snapshot.thinkingLevel, "high");
  assert.equal(snapshot.toolMode, "direct");
  assert.equal(snapshot.delegation, "eager");
  const current = (await f.request("nativeCapabilities", { sessionId: sleeping })).target.current;
  assert.equal(current.localTools, true);
  assert.deepEqual(current.scopedModels, ["sleepset/alternate", "sleepset/primary"]);
  const capabilities = await f.change(sleeping, "capabilities", {});
  assert.equal(capabilities.entries.find(({ id }) => id === "tool:ask").enabled, false);
  assert.equal(f.provider.requests.length, calls, "All edits and rejections make zero provider requests");
  assert.deepEqual(await f.kernels(), kernels, "All edits and rejections allocate zero owned REPLs");
  return shapes;
}
