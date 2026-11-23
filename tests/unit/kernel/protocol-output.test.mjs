import assert from "node:assert/strict";
import { StringDecoder } from "node:string_decoder";
import { test } from "node:test";
import { Value } from "typebox/value";
import { runnerEvent } from "../../../src/kernel/protocol/event-schema.ts";
import { receive } from "../../../src/kernel/protocol/receive.ts";
import { addOutput } from "../../../src/kernel/output/capture-output.ts";

test("typed kernel events reject unknown fields and invalid identities", () => {
  const event = { generation: "owned", cellId: "cell", kind: "callback_chunk", requestId: 1, channel: "gateway", data: "e30=", final: true };
  assert(Value.Check(runnerEvent, event));
  assert(!Value.Check(runnerEvent, { ...event, extra: true }));
  assert(!Value.Check(runnerEvent, { ...event, requestId: 0 }));
  assert(!Value.Check(runnerEvent, { ...event, final: "true" }));
  assert(!Value.Check(runnerEvent, { ...event, kind: "input_request" }));
});

test("ready requires a language and actual runtime version instead of a Python tuple", () => {
  const envelope = { kind: "ready", generation: "owned", cellId: null, pid: 42, pgid: 42, scoped: false };
  const current = { ...envelope, language: "python", version: "3.12.0" };
  assert(Value.Check(runnerEvent, current));
  for (const version of ["3.13.0a1", "3.13.0b2", "3.13.0rc1", "3.13.0rc1+", "3.13.0+vendor.2", "3.13.0-ubuntu1"]) {
    assert(Value.Check(runnerEvent, { ...current, version }), version);
  }
  assert(Value.Check(runnerEvent, { ...current, language: "bun", version: "1.3.5" }));
  for (const invalid of [envelope, { ...envelope, python: [3, 12, 0] }, { ...current, python: [3, 12, 0] },
    { ...current, generation: "" }, { ...current, cellId: "cell" }, { ...current, language: "other" },
    { ...envelope, version: current.version }, { ...envelope, language: current.language },
    ...["", "3.12", "3..12", "3.12.0.1", "3.12.0\n", "3.12.0rc", "3.12.0oops", "3.12.0+extra text", [3, 12, 0]].map((version) => ({ ...current, version }))]) {
    assert(!Value.Check(runnerEvent, invalid), JSON.stringify(invalid));
  }
});

test("cell state requires an owner; diagnostic forbids a cell identity", () => {
  const state = { kind: "cell_state", generation: "owned", cellId: "cell", state: "stopping", observedAt: 1 };
  const evidence = { step: "syscall", observedAt: 1, status: "observed", evidence: "waiting" };
  const diagnostic = { kind: "diagnostic", generation: "owned", stream: "stderr", text: "runner log" };
  assert(Value.Check(runnerEvent, state));
  assert(Value.Check(runnerEvent, { ...state, blockedAt: [evidence] }));
  assert(Value.Check(runnerEvent, { ...state, state: "running" }));
  assert(Value.Check(runnerEvent, diagnostic));
  for (const invalid of [{ ...state, cellId: null }, { ...state, cellId: "" }, { ...state, cellId: undefined },
    { ...state, state: "done" }, { ...state, observedAt: -1 }, { ...state, blockedAt: "sleep" },
    { ...state, blockedAt: [{ ...evidence, unexpected: true }] }, { ...state, blockedAt: Array(17).fill(evidence) },
    { ...diagnostic, cellId: null }, { ...diagnostic, cellId: "cell" }, { ...diagnostic, stream: "result" }]) {
    assert(!Value.Check(runnerEvent, invalid), JSON.stringify(invalid));
  }
  const idle = { generation: "owned", cellId: null };
  assert(Value.Check(runnerEvent, { ...idle, kind: "display", data: {}, metadata: {} }));
  assert(Value.Check(runnerEvent, { ...idle, kind: "fatal", error: "failed" }));
});

test("capture preserves bounded Unicode head and tail without broken surrogate pairs", () => {
  const state = { text: "", tail: "", omittedChars: 0, truncated: false };
  const original = "HEAD😀" + "中😀".repeat(40) + "😀TAIL";
  for (const part of [original.slice(0, 20), original.slice(20, 80), original.slice(80)]) addOutput(state, part, { maxOutputChars: 32 });
  assert(state.truncated);
  assert(state.text.startsWith("HEAD"));
  assert(state.tail.endsWith("TAIL"));
  assert(state.text.length + state.tail.length <= 32);
  assert.equal(state.text.length + state.tail.length + state.omittedChars, original.length);
  assert(!/[\uD800-\uDBFF]$/u.test(state.text));
  assert(!/^[\uDC00-\uDFFF]/u.test(state.tail));
});

function ingress(language = "python") {
  const process = {
    generation: "owned", language, decoder: new StringDecoder("utf8"), buffer: "",
    window: { retire(error) { throw error; } },
  };
  const ctx = { process, configuration: { processWindow: { maxFrameBytes: 1024 } }, options: { maxOutputChars: 5 },
    snapshot: { state: "starting" }, cells: new Map(), listeners: new Set(), closed: false };
  return { ctx, process,
    emit: (...frames) => receive(ctx, process, Buffer.from(frames.map((frame) => JSON.stringify({ generation: "owned", ...frame }) + "\n").join(""))),
  };
}

test("only the first ready from the current generation claims process identity", () => {
  for (const [language, version] of [["python", "3.12.0"], ["bun", "1.4.4"]]) {
    const target = ingress(language);
    let readyCount = 0;
    target.process.ready = { resolve() { readyCount++; } };
    const ready = { kind: "ready", cellId: null, pid: 42, pgid: 42, scoped: false, language, version };
    target.emit({ ...ready, generation: "stale" });
    assert.equal(readyCount, 0);
    target.emit(ready, { ...ready, pid: 43, pgid: 43, scoped: true });
    assert.equal(readyCount, 1);
    assert.deepEqual([target.process.pid, target.process.pgid, target.process.scoped], [42, 42, false]);
  }
});

test("generation diagnostics stay bounded per stream and remain visible while closing", () => {
  const target = ingress();
  const diagnostic = { kind: "diagnostic", stream: "stdout", text: "😀abc" };
  target.ctx.closed = true;
  target.emit(diagnostic, { ...diagnostic, stream: "stderr", text: "warn" }, { ...diagnostic, text: "d" },
    { ...diagnostic, generation: "stale", text: "wrong" });
  const expected = { stdout: "abcd", stderr: "warn", truncated: true };
  assert.deepEqual(target.ctx.snapshot.diagnostics, expected);
  target.ctx.process = {};
  target.emit(diagnostic);
  target.ctx.process = target.process;
  target.process.retired = true;
  target.emit(diagnostic);
  assert.deepEqual(target.ctx.snapshot.diagnostics, expected);
});

test("cell state updates only the live submitted owner without settling it", () => {
  const target = ingress();
  const owned = { id: "cell", kernelId: "owned", requestId: 1 };
  const reserved = { id: "reserved", kernelId: "owned" };
  target.ctx.cells.set(owned.id, owned);
  target.ctx.cells.set(reserved.id, reserved);
  const state = { kind: "cell_state", cellId: owned.id, state: "stopping", observedAt: 12 };
  target.emit(state, { ...state, state: "running", generation: "stale" }, { ...state, cellId: reserved.id });
  assert.equal(owned.runnerState?.state, "stopping");
  assert.equal(owned.runnerState?.observedAt, 12);
  assert.equal(owned.outcome, undefined);
  assert.equal(reserved.runnerState, undefined);
});
