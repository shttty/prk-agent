import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { request } from "node:http";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { until } from "../../fixtures/until.mjs";
import { gatewayFixture } from "../../fixtures/gateway/assemble-gateway.mjs";

for (const remote of [false, true]) {
  test(`${remote ? "loopback remote" : "local"} file preview and streamed upload/download preserve bytes`, async (t) => {
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
    const bytes = randomBytes(9 * 1024 ** 2 + 19);
    const path = join(f.cwd, "payload.bin");
    const uploadHeaders = { ...headers, "Content-Type": "application/octet-stream" };
    const destination = `${base}/upload?${new URLSearchParams({ target: f.target, path })}`;
    const upload = (url, body) => fetch(url, { method: "POST", headers: uploadHeaders, body, signal: AbortSignal.timeout(30_000) });
    const uploaded = await upload(destination, bytes);
    assert.equal(uploaded.status, 200, uploaded.ok ? undefined : await uploaded.text());
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
    const clash = await upload(destination, Buffer.from("replacement"));
    assert.equal(clash.status, 409);
    assert.equal((await clash.json()).code, "CONFLICT");
    assert((await readFile(path)).equals(bytes));

    // Disconnect after bytes reached the staged file, not merely after opening the HTTP request.
    const interrupted = request(`${destination}&overwrite=true`, { method: "POST", headers: uploadHeaders });
    t.after(() => interrupted.destroy());
    interrupted.on("error", () => { /* Intentional disconnect. */ });
    interrupted.write(bytes.subarray(0, 350 * 1024));
    const staged = await until(async () => {
      const name = (await readdir(f.cwd)).find((item) => item.includes(".prk-upload-"));
      return name && (await stat(join(f.cwd, name))).size > 0 && name;
    }, "partially written target staging file");
    interrupted.destroy();
    await until(async () => !(await readdir(f.cwd)).includes(staged), "interrupted upload staging removal");
    assert((await readFile(path)).equals(bytes));
    // A conflict discovered at publication must still return JSON after HTTP has read the whole body.
    const concurrentPath = join(f.cwd, "concurrent.bin");
    const concurrent = request(`${base}/upload?${new URLSearchParams({ target: f.target, path: concurrentPath })}`, { method: "POST", headers: uploadHeaders });
    t.after(() => concurrent.destroy());
    const finalResponse = once(concurrent, "response", { signal: AbortSignal.timeout(15_000) });
    void finalResponse.catch(() => {});
    concurrent.write(Buffer.from("unpublished body"));
    await until(async () => (await readdir(f.cwd)).some((name) => name.startsWith(".concurrent.bin.prk-upload-")), "upload passed initial name check");
    await writeFile(concurrentPath, "external file");
    concurrent.end();
    const [failed] = await finalResponse;
    assert.equal(failed.statusCode, 409);
    const errorBody = [];
    for await (const chunk of failed) errorBody.push(chunk);
    assert.equal(JSON.parse(Buffer.concat(errorBody)).code, "CONFLICT");
    assert.equal(await readFile(concurrentPath, "utf8"), "external file");
    const replacement = Buffer.from("confirmed overwrite");
    const replaced = await upload(`${destination}&overwrite=true`, replacement);
    assert.equal(replaced.status, 200, replaced.ok ? undefined : await replaced.text());
    assert((await readFile(path)).equals(replacement));
    assert.deepEqual((await readdir(f.cwd)).filter((entry) => entry.includes(".prk-upload-")), []);
  });
}
