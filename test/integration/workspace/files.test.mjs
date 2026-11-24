import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { gatewayFixture } from "../../fixtures/gateway/assemble-gateway.mjs";

for (const remote of [false, true]) {
  test(`${remote ? "loopback remote" : "local"} file preview and streamed download preserve bytes`, async (t) => {
    const f = await gatewayFixture(t, { remote, web: true });
    await f.deploy();
    const sessionId = await f.create();
    const base = `${f.url}/api/sessions/${sessionId}/files`;
    const headers = { Origin: f.url };
    const note = join(f.cwd, "sample.txt");
    await writeFile(note, "Target text π\n");
    const preview = await fetch(`${base}/read`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ target: f.target, path: note, format: "text" }) });
    assert.equal(preview.status, 200, preview.ok ? undefined : await preview.text());
    assert.equal((await preview.json()).content, "Target text π\n");
    const bytes = randomBytes(4 * 1024 ** 2);
    const path = join(f.cwd, "payload.bin");
    await writeFile(path, bytes);
    const response = await fetch(`${base}/download`, { method: "POST", headers, body: new URLSearchParams({ target: f.target, path }), signal: AbortSignal.timeout(30_000) });
    assert.equal(response.status, 200, response.ok ? undefined : await response.text());
    assert.equal(response.headers.get("content-length"), String(bytes.length));
    assert.match(response.headers.get("content-disposition"), /^attachment;.*payload\.bin/);
    let offset = 0, chunks = 0;
    for await (const chunk of response.body) {
      assert(Buffer.from(chunk).equals(bytes.subarray(offset, offset + chunk.length)), `byte mismatch at ${offset}`);
      offset += chunk.length;
      chunks++;
    }
    assert.equal(offset, bytes.length);
    assert(chunks > 1);
  });
}
