import assert from "node:assert/strict";
import test from "node:test";
import { parseProcessWindowLimits } from "../../../src/target-environment/process-window/parse-limits.ts";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { createProcessWindow } from "../../../src/target-environment/process-window/assemble-window.ts";

test("process window has one default and strict configurable limits", () => {
  const defaults = parseProcessWindowLimits();
  assert.deepEqual(defaults, { maxRequests: 32, maxBytes: 2097152, maxFrameBytes: 1048576 });
  const config = parsePrkConfig({ processWindow: { maxRequests: 2, maxBytes: 100, maxFrameBytes: 50 } });
  assert.deepEqual(config.processWindow, { maxRequests: 2, maxBytes: 100, maxFrameBytes: 50 });
  const window = createProcessWindow(config.processWindow);
  window.reserve(1, 50);
  window.reserve(2, 50);
  assert.throws(() => window.reserve(3, 1), { code: "BUSY" });
  for (const value of [null, [], 1, { extra: 1 }, { maxRequests: 0 }, { maxBytes: 1.5 },
    { maxFrameBytes: "2" }, { maxBytes: 10, maxFrameBytes: 11 }, { maxRequests: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.throws(() => parseProcessWindowLimits(value), { code: "INVALID_REQUEST" });
  }
});

test("file and terminal consumers use validated shared configuration", () => {
  const config = parsePrkConfig({});
  assert.deepEqual(config.references, { maxBytes: 262144, maxEntries: 1000, listingBytes: 262144, timeoutMs: 10000 });
  assert.deepEqual(config.targetConnection, { startTimeoutMs: 15000, requestTimeoutMs: 10000 });
  assert.equal(config.workspace.fileChunkBytes, 262144);
  assert.throws(() => parsePrkConfig({ workspace: { fileChunkBytes: 16711681 } }));
  for (const key of ["fileChunkBytes", "directoryEntries", "directoryBytes", "directoryPageEntries", "fileRequestsMax",
    "terminalInputBytes", "terminalStartTimeoutMs", "terminalCloseTimeoutMs"]) {
    assert(config.workspace[key] > 0);
    assert.throws(() => parsePrkConfig({ workspace: { [key]: 0 } }));
    assert.throws(() => parsePrkConfig({ workspace: { [key]: 1.5 } }));
  }
  assert.throws(() => parsePrkConfig({ references: { timeoutMs: 2147483648 } }));
  assert.throws(() => parsePrkConfig({ targetConnection: { unknown: 1 } }));
});
