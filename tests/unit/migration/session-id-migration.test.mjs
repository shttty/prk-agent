import assert from "node:assert/strict";
import { test } from "node:test";
import { planMigration } from "../../../scripts/session-id-migration/plan-migration.mjs";
import { selectSessionPaths } from "../../../scripts/session-id-migration/inventory/select-session-paths.mjs";

const home = "/isolated/prk-home";
const qqState = "/isolated/qq-state";
const file = (path, value) => ({ path, text: `${JSON.stringify(value)}\n` });
const session = (path, id, name) => ({ path, text: [
  { type: "session", version: 3, id, cwd: "/target/project", timestamp: "2026-11-05T00:00:00.000Z" },
  { type: "custom", id: "binding", parentId: null, timestamp: "2026-11-05T00:00:00.000Z", customType: "gateway-worker-binding", data: { version: 2, sessionId: id, name, target: "remote", kernelName: "python3", cwd: "/target/project" } },
].map((entry) => JSON.stringify(entry)).join("\n") + "\n" });

test("session-id migration prepares the complete rewrite and refuses non-unique or missing Pi references without mutating inputs", () => {
  const parent = session(`${home}/sessions/slot-a.jsonl`, "pi-parent", "parent-slot");
  const child = session(`${home}/sessions/slot-b.jsonl`, "pi-child", "child-slot");
  const header = JSON.parse(child.text.split("\n")[0]);
  child.text = child.text.replace(JSON.stringify(header), JSON.stringify({ ...header, parentSession: parent.path }));
  const metadata = (id, customType, data) => JSON.stringify({ type: "custom", id, parentId: "binding", timestamp: header.timestamp, customType, data });
  const message = '{ "type":"message", "id":"reply", "parentId":"binding", "timestamp":"2026-11-05T00:00:00.000Z", "message":{"role":"user","content":[{"type":"text","text":"parent-slot stays literal; target files stay remote"}],"timestamp":1} }\r\n';
  child.text += metadata("inherited-binding", "gateway-worker-binding", { version: 2, sessionId: "pi-parent", name: "parent-slot", target: "remote", kernelName: "python3", cwd: "/target/project" }) + "\n";
  child.text += metadata("derived", "gateway-derived-session", { sessionId: "pi-child", createdBy: "parent-slot", owner: "pi-parent", pendingOwner: "parent-slot", taskId: "not-a-session", task: "keep me" }) + "\n";
  child.text += metadata("project", "gateway-worker-project", { version: 1, project: { id: "project-1", name: "parent-slot" } }) + "\n";
  child.text += metadata("retarget", "gateway-worker-retarget", { version: 1, sessionId: "pi-child", target: "remote", kernelName: "python3", cwd: "/target/new" }) + "\n";
  child.text += metadata("kernel", "gateway-worker-kernel-binding", { version: 1, sessionId: "pi-child", name: "child-slot", target: "remote", kernelId: "kernel-1", kernelName: "python3", cwd: "/target/new", url: "http://remote.invalid/", status: "active" }) + "\n";
  child.text += metadata("archive", "gateway-session-trash", { version: 1, sessionId: "pi-child", trashed: true, group: "parent-slot", at: header.timestamp }) + "\n";
  child.text += message;
  const inventory = { home, qqState, sessions: [parent, child], sidecars: {
    terminals: file(`${home}/sessions/terminal-bindings.json`, [{ worker: "child-slot", name: "terminal-name", target: "remote", serverName: "prk_0123456789abcdef0123456789abcdef" }]),
    control: file(`${home}/session-control.json`, { rootSessionId: "pi-parent", supervisors: { "project-1": "pi-parent" } }),
    currentWorker: file(`${qqState}/current-worker.json`, { name: "child-slot", sessionId: "pi-child" }),
  } };
  const original = structuredClone(inventory);
  const changes = planMigration(inventory);
  assert.deepEqual(inventory, original);
  const rewritten = changes.find((change) => change.source === child.path);
  assert.equal(rewritten.destination, `${home}/sessions/pi-child.jsonl`);
  assert.ok(rewritten.text.endsWith(message), "SDK message bytes and CRLF must stay unchanged");
  const entries = rewritten.text.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(entries[0].parentSession, `${home}/sessions/pi-parent.jsonl`);
  assert.deepEqual(entries[1].data, { version: 3, sessionId: "pi-child", target: "remote", kernelName: "python3", cwd: "/target/project" });
  assert.deepEqual(entries.find((entry) => entry.id === "inherited-binding").data, { version: 3, sessionId: "pi-parent", target: "remote", kernelName: "python3", cwd: "/target/project" });
  assert.deepEqual(entries.find((entry) => entry.id === "derived").data, { sessionId: "pi-child", createdBy: "pi-parent", owner: "pi-parent", pendingOwner: "pi-parent", taskId: "not-a-session", task: "keep me" });
  assert.deepEqual(entries.find((entry) => entry.id === "project").data.project, { id: "project-1", name: "parent-slot" });
  assert.equal(entries.find((entry) => entry.id === "project").customType, "gateway-session-project");
  assert.equal(entries.find((entry) => entry.id === "retarget").customType, "gateway-session-retarget");
  const kernel = entries.find((entry) => entry.id === "kernel");
  assert.equal(kernel.customType, "gateway-session-kernel-binding");
  assert.equal(Object.hasOwn(kernel.data, "name"), false);
  assert.equal(kernel.data.kernelId, "kernel-1");
  assert.equal(entries.find((entry) => entry.id === "archive").data.group, "pi-parent");
  assert.deepEqual(JSON.parse(changes.find((change) => change.source.endsWith("terminal-bindings.json")).text), [{ sessionId: "pi-child", name: "terminal-name", target: "remote", serverName: "prk_0123456789abcdef0123456789abcdef" }]);
  const selection = changes.find((change) => change.source.endsWith("current-worker.json"));
  assert.equal(selection.destination, `${qqState}/current-session.json`);
  assert.deepEqual(JSON.parse(selection.text), { sessionId: "pi-child" });

  for (const broken of [
    { ...inventory, sessions: [...inventory.sessions, session(`${home}/sessions/reused-slot.jsonl`, "another-pi-id", "child-slot")] },
    { ...inventory, sessions: [...inventory.sessions, session(`${home}/sessions/duplicate-id.jsonl`, "pi-child", "another-slot")] },
    { ...inventory, sidecars: { ...inventory.sidecars, currentWorker: file(`${qqState}/current-worker.json`, { name: "unknown-slot", sessionId: "missing-pi-id" }) } },
    { ...inventory, sessions: [parent, { ...child, text: child.text.replace('"sessionId":"pi-parent","name":"parent-slot"', '"name":"parent-slot"') }] },
  ]) {
    const before = structuredClone(broken);
    assert.throws(() => planMigration(broken), (error) => {
      assert.match(error.message, /preflight failed; no files were written/);
      assert.match(error.message, /multiple Pi ids|multiple files|missing Pi id/);
      assert.match(error.message, /reused-slot\.jsonl|duplicate-id\.jsonl|current-worker\.json|slot-b\.jsonl/);
      return true;
    });
    assert.deepEqual(broken, before);
  }
});

test("a dual-meaning session reference rejects different native-id and legacy-route candidates", () => {
  const native = session(`${home}/sessions/native.jsonl`, "shared-reference", "native-slot");
  const route = session(`${home}/sessions/route.jsonl`, "other-pi-id", "shared-reference");
  route.text += JSON.stringify({ type: "custom", id: "derived", parentId: "binding", customType: "gateway-derived-session", data: { sessionId: "other-pi-id", createdBy: "shared-reference", owner: null } }) + "\n";
  assert.throws(() => planMigration({ home, qqState, sessions: [native, route], sidecars: {} }), (error) => {
    assert.match(error.message, /ambiguous session reference "shared-reference"/);
    assert.ok(error.message.includes(`${native.path}/header.id`));
    assert.ok(error.message.includes(`${route.path}:2`));
    return true;
  });
});

test("unmanaged SDK files and their parent paths stay unchanged", () => {
  const parent = file("/explicit-history/native-parent.jsonl", { type: "session", version: 3, id: "native-parent", cwd: "/project" });
  const child = session("/explicit-history/child-slot.jsonl", "pi-child", "child-slot");
  const header = JSON.parse(child.text.split("\n")[0]);
  child.text = child.text.replace(JSON.stringify(header), JSON.stringify({ ...header, parentSession: "native-parent.jsonl" }));
  const foreign = session("/explicit-history/unmanaged.jsonl", "unmanaged-pi-id", "foreign-slot");
  foreign.text = foreign.text.replace('"sessionId":"unmanaged-pi-id"', '"sessionId":"pi-child"');
  const inventory = { home, qqState, sessions: [parent, child, foreign], sidecars: {} };
  const before = structuredClone(inventory);
  const changes = planMigration(inventory);
  assert.deepEqual(inventory, before);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].source, child.path);
  assert.equal(changes[0].destination, "/explicit-history/pi-child.jsonl");
  assert.equal(JSON.parse(changes[0].text.split("\n")[0]).parentSession, "native-parent.jsonl");
});

test("single-layer discovery includes a bound JSONL with a missing or unreadable header and refuses it", () => {
  const selected = selectSessionPaths("/explicit-history", ["notes.txt", "nested", "damaged.jsonl"]);
  assert.deepEqual(selected, ["/explicit-history/damaged.jsonl"]);
  const binding = session(selected[0], "pi-damaged", "damaged-slot").text.split("\n")[1];
  for (const header of ["", "{broken header}\n"]) {
    const damaged = { path: selected[0], text: `${header}${binding}\n` };
    const inventory = { home, qqState, sessions: [damaged], sidecars: {} };
    const before = structuredClone(inventory);
    assert.throws(() => planMigration(inventory), (error) => {
      assert.match(error.message, /preflight failed; no files were written/);
      assert.ok(error.message.includes(damaged.path));
      assert.match(error.message, /missing Pi session header/);
      return true;
    });
    assert.deepEqual(inventory, before);
  }
});
