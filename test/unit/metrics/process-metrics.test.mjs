import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { describeFrame } from "../../../src/gateway/socket-channel/describe-frame.ts";
import { readPluginLabel } from "../../../src/sessions/extension-invocation/read-plugin-label.ts";
import { gatewayRegistry } from "../../../src/metrics/registry/gateway-registry.ts";
import { bindSessionStates } from "../../../src/metrics/instruments/bind-session-states.ts";
import { recordSerialization } from "../../../src/metrics/timing/record-serialization.ts";
import { stallSettings } from "../../../src/metrics/stall/stall-settings.ts";

test("frames map to a small fixed set of kinds and keep their session", () => {
  assert.deepEqual(describeFrame({ v: 1, id: 3, ok: true, result: { sessionId: "s1" } }), { kind: "frame_response", sessionId: "s1" });
  assert.deepEqual(describeFrame({ v: 1, sessionId: "s1", event: { type: "snapshot" } }), { kind: "frame_snapshot", sessionId: "s1" });
  assert.deepEqual(describeFrame({ v: 1, sessionId: "s1", event: { type: "message" } }), { kind: "frame_event", sessionId: "s1" });
  assert.deepEqual(describeFrame({ v: 1, collection: { type: "x", sessionId: "s2" } }), { kind: "frame_collection", sessionId: undefined });
  assert.equal(describeFrame({ v: 1, terminal: {} }).kind, "frame_terminal");
  assert.equal(describeFrame("raw").kind, "frame_other");
});

test("plugin labels are package names, inline names or file names, never paths", () => {
  const extension = (path, origin, source = path) => ({ sourceInfo: { path, origin, source, scope: "user" } });
  assert.equal(readPluginLabel(extension("<inline:prompt-capture>", "top-level")), "prompt-capture");
  assert.equal(readPluginLabel(extension("/home/user/agent/extensions/slow-hook.js", "top-level")), "slow-hook");
  assert.equal(readPluginLabel(extension("/home/user/agent/extensions/memo/index.ts", "top-level")), "memo");
});

test("metrics options reject unknown keys and out-of-range values, defaults keep 200 ms", () => {
  const parsed = parsePrkConfig({}, { instances: [] });
  assert.deepEqual(parsed.metrics, { enabled: true, host: "127.0.0.1", port: 9464, stallThresholdMs: 200, eventLoopWindowMs: 1000 });
  assert.throws(() => parsePrkConfig({ metrics: { bind: "0.0.0.0" } }, { instances: [] }), /unsupported metrics\.bind/);
  assert.throws(() => parsePrkConfig({ metrics: { stallThresholdMs: 0 } }, { instances: [] }), /metrics\.stallThresholdMs/);
  assert.throws(() => parsePrkConfig({ metrics: { port: 70000 } }, { instances: [] }), /metrics\.port/);
});

test("the session gauge reports every state the host gives it and none after unbinding", async () => {
  const unbind = bindSessionStates(() => ({ idle: 2, running: 1 }));
  assert.match(await gatewayRegistry.metrics(), /prk_sessions\{state="idle"\} 2\nprk_sessions\{state="running"\} 1/);
  unbind();
  assert.doesNotMatch(await gatewayRegistry.metrics(), /prk_sessions\{/);
});

test("a serialization at or above the threshold logs one line with kind, session, duration and bytes", (t) => {
  const lines = [];
  t.mock.method(console, "error", (line) => { lines.push(line); });
  const before = stallSettings.thresholdMs;
  stallSettings.thresholdMs = 50;
  t.after(() => { stallSettings.thresholdMs = before; });
  recordSerialization("frame_snapshot", performance.now() - 80, 4096, () => "s1");
  recordSerialization("frame_snapshot", performance.now(), 10, () => "s1");
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[\d{4}-\d\d-\d\dT[\d:.]+Z\] WARN Gateway stall kind=frame_snapshot sessionId=s1 durationMs=\d+ bytes=4096$/);
});
