import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { request } from "node:http";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { json } from "node:stream/consumers";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { until } from "../../fixtures/until.mjs";
import { gatewayFixture } from "../../fixtures/gateway/assemble-gateway.mjs";

const requestTimeoutMs = 600;
const uploadIdleTimeoutMs = 1500;

for (const remote of [false, true]) {
  test(`${remote ? "loopback remote" : "local"} file preview and streamed upload/download preserve bytes`, { concurrency: true }, async (t) => {
    const config = remote ? {} : { http: { requestTimeoutMs, uploadIdleTimeoutMs } };
    const f = await gatewayFixture(t, { remote, web: true, config });
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
    if (!remote) await verifyUploadDeadlines(t, f, base);
  });
}

const progressParts = 8;
const progressIntervalMs = 225;
const chunk = "part";

async function verifyUploadDeadlines(t, f, base) {
  const workspaceUpload = (path) => `${base}/upload?${new URLSearchParams({ target: f.target, path })}`;
  const artifactUpload = (version) => `${f.url}/api/artifacts/upload?name=fixture-upload&version=${version}&platform=x86_64`;
  const octetStream = { Origin: f.url, "Content-Type": "application/octet-stream" };

  await Promise.all([
    t.test("ordinary JSON receiving bytes still exceeds its fixed deadline", async (t) => {
      const { req, response } = post(t, `${base}/read`, { Origin: f.url, "Content-Type": "application/json" });
      req.write('{"target":"fixture"');
      const progress = setInterval(() => req.write(" "), 100);
      try {
        const res = await response;
        assert.equal(res.statusCode, 408);
        assert.match((await json(res)).error, /body deadline exceeded/);
      } finally {
        clearInterval(progress);
      }
    }),
    t.test("a workspace upload with progress outlives both deadlines", async (t) => {
      const path = join(f.cwd, "slow.bin");
      const { req, response } = post(t, workspaceUpload(path), octetStream);
      await sendWithProgress(req);
      const res = await response;
      const body = await json(res);
      assert.equal(res.statusCode, 200, JSON.stringify(body));
      assert.deepEqual(body, { uploaded: true });
      assert.equal(await readFile(path, "utf8"), chunk.repeat(progressParts));
    }),
    t.test("a stalled workspace upload fails and removes target staging", async (t) => {
      const path = join(f.cwd, "stalled.bin");
      const { req, response } = post(t, workspaceUpload(path), octetStream);
      req.write(chunk);
      const staged = await waitForStagedBytes(f.cwd, ".stalled.bin.prk-upload-");
      await expectStalled(response);
      await until(async () => !(await readdir(f.cwd)).includes(staged), "target upload staging removal");
      await assert.rejects(stat(path), { code: "ENOENT" });
    }),
    t.test("artifact upload uses the same idle deadline and retains its byte cap", async (t) => {
      const { req, response } = post(t, artifactUpload("slow"), octetStream);
      await sendWithProgress(req);
      const res = await response;
      const body = await json(res);
      assert.equal(res.statusCode, 200, JSON.stringify(body));
      const entry = body.tools["fixture-upload"].versions.slow.platforms.x86_64;
      assert.equal(entry.size, chunk.length * progressParts);
      assert.equal(await readFile(join(f.root, "assets", "store", entry.sha256), "utf8"), chunk.repeat(progressParts));
      const uploads = join(f.root, "uploads");
      await until(async () => (await readdir(uploads)).length === 0, "completed artifact staging removal");

      const stalled = post(t, artifactUpload("stalled"), octetStream);
      stalled.req.write(chunk);
      const staged = await waitForStagedBytes(uploads, "upload-");
      await expectStalled(stalled.response);
      assert(!(await readdir(uploads)).includes(staged));
      const manifest = await f.request("artifactsList", {});
      assert(!Object.hasOwn(manifest.tools["fixture-upload"].versions, "stalled"));

      const oversized = post(t, artifactUpload("over"), { ...octetStream, "Content-Length": 200 * 1024 ** 2 + 1 });
      oversized.req.flushHeaders();
      const rejected = await oversized.response;
      assert.equal(rejected.statusCode, 413);
      await json(rejected);
    }),
  ]);
}

function post(t, url, headers) {
  const req = request(url, { method: "POST", headers, signal: AbortSignal.timeout(10_000) });
  t.after(() => req.destroy());
  const response = once(req, "response").then(([res]) => res);
  void response.catch(() => {});
  return { req, response };
}

async function sendWithProgress(req) {
  for (let i = 0; i < progressParts; i++) {
    req.write(chunk);
    await delay(progressIntervalMs);
  }
  req.end();
}

async function waitForStagedBytes(directory, prefix) {
  return until(async () => {
    const name = (await readdir(directory).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return [];
    })).find((item) => item.startsWith(prefix));
    return name && (await stat(join(directory, name))).size > 0 && name;
  }, `partially written upload staging in ${directory}`);
}

async function expectStalled(response) {
  const res = await response;
  assert.equal(res.statusCode, 408);
  assert.match((await json(res)).error, /stalled while waiting for request body bytes/);
  assert.equal(res.headers.connection, "close");
}
