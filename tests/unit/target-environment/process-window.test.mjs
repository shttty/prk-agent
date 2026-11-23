import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { createProcessWindow } from "../../../src/target-environment/process-window/assemble-window.ts";

test("omitted options create an empty, usable process window", () => {
  const window = createProcessWindow();
  assert.deepEqual(window.snapshot(), { requests: 0, bytes: 0 });
  window.reserve(1, 1);
  assert.deepEqual(window.snapshot(), { requests: 1, bytes: 1 });
  window.confirm(1);
  assert.deepEqual(window.snapshot(), { requests: 0, bytes: 0 });
});

test("request limit admits its exact boundary and failed admission consumes no capacity", () => {
  const window = createProcessWindow({ maxRequests: 2, maxBytes: 10, maxFrameBytes: 5 });
  window.reserve(1, 2);
  window.reserve(2, 3);
  assert.deepEqual(window.snapshot(), { requests: 2, bytes: 5 });
  for (let attempt = 0; attempt < 3; attempt++) {
    assert.throws(() => window.reserve(3, 1), { code: "BUSY" });
    assert.deepEqual(window.snapshot(), { requests: 2, bytes: 5 });
  }
  window.confirm(1);
  assert.deepEqual(window.snapshot(), { requests: 1, bytes: 3 });
  window.reserve(3, 5);
  assert.deepEqual(window.snapshot(), { requests: 2, bytes: 8 });
  assert.throws(() => window.reserve(4, 1), { code: "BUSY" });
  window.confirm(2);
  window.confirm(3);
  assert.deepEqual(window.snapshot(), { requests: 0, bytes: 0 });
});

test("byte limit admits its exact boundary independently of available request slots", () => {
  const window = createProcessWindow({ maxRequests: 4, maxBytes: 7, maxFrameBytes: 5 });
  window.reserve(1, 4);
  window.reserve(2, 3);
  assert.deepEqual(window.snapshot(), { requests: 2, bytes: 7 });
  for (let attempt = 0; attempt < 3; attempt++) {
    assert.throws(() => window.reserve(3, 1), { code: "BUSY" });
    assert.deepEqual(window.snapshot(), { requests: 2, bytes: 7 });
  }
  window.confirm(2);
  assert.deepEqual(window.snapshot(), { requests: 1, bytes: 4 });
  window.reserve(3, 3);
  assert.deepEqual(window.snapshot(), { requests: 2, bytes: 7 });
  window.confirm(1);
  assert.deepEqual(window.snapshot(), { requests: 1, bytes: 3 });
  window.confirm(3);
  assert.deepEqual(window.snapshot(), { requests: 0, bytes: 0 });
});

test("multibyte UTF-8 frame sizes reserve and release their actual byte lengths", () => {
  const window = createProcessWindow({ maxRequests: 4, maxBytes: 8, maxFrameBytes: 6 });
  window.reserve(1, Buffer.byteLength("猫"));
  window.reserve(2, Buffer.byteLength("🙂"));
  assert.deepEqual(window.snapshot(), { requests: 2, bytes: 7 });
  assert.throws(() => window.reserve(3, Buffer.byteLength("é")), { code: "BUSY" });
  assert.deepEqual(window.snapshot(), { requests: 2, bytes: 7 });
  window.reserve(4, Buffer.byteLength("x"));
  assert.deepEqual(window.snapshot(), { requests: 3, bytes: 8 });
  window.confirm(2);
  assert.deepEqual(window.snapshot(), { requests: 2, bytes: 4 });
  window.reserve(3, Buffer.byteLength("éé"));
  assert.deepEqual(window.snapshot(), { requests: 3, bytes: 8 });
  window.confirm(1);
  window.confirm(3);
  window.confirm(4);
  assert.deepEqual(window.snapshot(), { requests: 0, bytes: 0 });
});

test("frame limit rejects one byte over without reserving an id or aggregate capacity", () => {
  const window = createProcessWindow({ maxRequests: 3, maxBytes: 10, maxFrameBytes: 5 });
  assert.throws(() => window.reserve(1, Buffer.byteLength("é猫x")), { code: "FRAME_TOO_LARGE" });
  assert.deepEqual(window.snapshot(), { requests: 0, bytes: 0 });
  window.reserve(1, Buffer.byteLength("é猫"));
  assert.deepEqual(window.snapshot(), { requests: 1, bytes: 5 });
  assert.throws(() => window.reserve(2, 6), { code: "FRAME_TOO_LARGE" });
  assert.deepEqual(window.snapshot(), { requests: 1, bytes: 5 });
  window.reserve(2, 5);
  assert.deepEqual(window.snapshot(), { requests: 2, bytes: 10 });
});

test("duplicate reservation cannot replace the original request's byte accounting", () => {
  const window = createProcessWindow({ maxRequests: 3, maxBytes: 9, maxFrameBytes: 6 });
  window.reserve(1, 3);
  assert.throws(() => window.reserve(1, 5), { code: "INVALID_REQUEST" });
  assert.deepEqual(window.snapshot(), { requests: 1, bytes: 3 });
  window.reserve(2, 6);
  assert.deepEqual(window.snapshot(), { requests: 2, bytes: 9 });
  window.confirm(1);
  assert.deepEqual(window.snapshot(), { requests: 1, bytes: 6 });
  window.confirm(2);
  assert.deepEqual(window.snapshot(), { requests: 0, bytes: 0 });
});

test("unknown and duplicate confirmations never grant extra count or byte credit", () => {
  const window = createProcessWindow({ maxRequests: 2, maxBytes: 7, maxFrameBytes: 5 });
  window.reserve(1, 2);
  window.reserve(2, 5);
  window.confirm(999);
  assert.deepEqual(window.snapshot(), { requests: 2, bytes: 7 });
  window.confirm(2);
  assert.deepEqual(window.snapshot(), { requests: 1, bytes: 2 });
  window.confirm(2);
  window.confirm(999);
  assert.deepEqual(window.snapshot(), { requests: 1, bytes: 2 });
  window.reserve(3, 5);
  assert.deepEqual(window.snapshot(), { requests: 2, bytes: 7 });
  assert.throws(() => window.reserve(4, 1), { code: "BUSY" });
  window.confirm(1);
  window.confirm(2);
  assert.deepEqual(window.snapshot(), { requests: 1, bytes: 5 });
  window.confirm(3);
  assert.deepEqual(window.snapshot(), { requests: 0, bytes: 0 });
});

test("retirement clears reservations and permanently prevents reuse", () => {
  const window = createProcessWindow({ maxRequests: 2, maxBytes: 7, maxFrameBytes: 5 });
  window.reserve(1, 2);
  window.reserve(2, 5);
  window.retire();
  assert.deepEqual(window.snapshot(), { requests: 0, bytes: 0 });
  window.confirm(1);
  window.confirm(2);
  window.confirm(999);
  window.retire();
  assert.deepEqual(window.snapshot(), { requests: 0, bytes: 0 });
  for (const id of [1, 3]) {
    assert.throws(() => window.reserve(id, 1), { code: "unknown" });
    assert.deepEqual(window.snapshot(), { requests: 0, bytes: 0 });
  }
});

test("each configured limit must be a finite positive safe integer", () => {
  const valid = { maxRequests: 2, maxBytes: 8, maxFrameBytes: 1 };
  const invalid = [0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, "2", null, true];
  for (const key of Object.keys(valid)) {
    for (const value of invalid) {
      assert.throws(() => createProcessWindow({ ...valid, [key]: value }), `${key}=${String(value)}`);
    }
  }
  assert.throws(() => createProcessWindow({ maxRequests: 2, maxBytes: 8, maxFrameBytes: 9 }));
});

test("one is a valid limit and an equal frame and aggregate limit is usable", () => {
  const window = createProcessWindow({ maxRequests: 1, maxBytes: 1, maxFrameBytes: 1 });
  window.reserve(1, 1);
  assert.deepEqual(window.snapshot(), { requests: 1, bytes: 1 });
  assert.throws(() => window.reserve(2, 1), { code: "BUSY" });
  window.confirm(1);
  window.reserve(2, 1);
  assert.deepEqual(window.snapshot(), { requests: 1, bytes: 1 });
});
