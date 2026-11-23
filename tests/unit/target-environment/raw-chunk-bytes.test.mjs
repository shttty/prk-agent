import assert from "node:assert/strict";
import { test } from "node:test";
import { rawChunkBytes } from "../../../src/target-channel/request-budget/raw-chunk-bytes.ts";
import { parseProcessWindowLimits } from "../../../src/target-environment/process-window/parse-limits.ts";

test("raw chunks fit actual JSON/Base64 envelopes without changing configured limits", () => {
  for (const maxFrameBytes of [512, 65536, 1048576]) {
    const limits = parseProcessWindowLimits({ maxRequests: 1, maxBytes: maxFrameBytes, maxFrameBytes });
    const fields = { generation: 'unicode-λ-"\\', offset: 123456789, total: 16777216, last: false };
    const size = rawChunkBytes(limits, "remoteExtensions", "frameChunk", fields, 1048576);
    const serialized = (bytes) => Buffer.byteLength(JSON.stringify({ ...fields, data: Buffer.alloc(bytes).toString("base64"),
      id: Number.MAX_SAFE_INTEGER, mod: "remoteExtensions", op: "frameChunk" })) + 1;
    assert(serialized(size) <= maxFrameBytes);
    assert(serialized(size + 3) > maxFrameBytes);
    assert.equal(limits.maxFrameBytes, maxFrameBytes);
    assert.equal(rawChunkBytes(limits, "remoteExtensions", "frameChunk", fields, 1), 1);
  }
});

test("an envelope that leaves no Base64 unit is rejected before sending", () => {
  const limits = parseProcessWindowLimits({ maxRequests: 1, maxBytes: 1, maxFrameBytes: 1 });
  assert.throws(() => rawChunkBytes(limits, "remoteExtensions", "assetChunk", { sha256: "x", offset: 0 }, 1), { code: "FRAME_TOO_LARGE" });
});
