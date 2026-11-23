import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocket } from "ws";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { createWorkspaceOwner } from "./proxy/create-owner.mjs";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { connectWebGateway } from "../../src/http/gateway-connection/connect-gateway.ts";
import { startWebServer } from "../../src/http/listener/start-listener.ts";

// Real HTTP/WebSocket -> API client -> Gateway subscription boundary.
// S6 has not switched the Gateway assembly: this test does not claim new PTY lifecycle coverage.
await withTargetFixture(async ({ config: target, tempRoot }) => {
  const root = await mkdtemp(join(tmpdir(), "prk-S3-ws-"));
  initializePrkHome(root);
  const owners = [], sockets = [];
  const instancesDocument = { instances: [{ id: "owned", label: "Owned", url: target.url, token: target.token, cwd: tempRoot, kernel: target.kernelOptions }] };
  const prkConfig = {};
  const options = parsePrkConfig(prkConfig, instancesDocument);
  const deadline = async (promise, label) => {
    const expired = Promise.withResolvers();
    const timer = setTimeout(() => expired.reject(new Error(`Timeout ${label}`)), 60000);
    try { return await Promise.race([promise, expired.promise]); } finally { clearTimeout(timer); }
  };
  const { owner, client, adapter, web } = await createWorkspaceOwner({ root, owners, target, deadline, socket: join(root, "g.sock"), prkConfig, instancesDocument, options, connectGateway, connectWebGateway, startWebServer });
  let sessionId;
  async function until(predicate) {
    for (let i = 0; i < 500; i++) { if (await predicate()) return; await delay(20); }
    throw new Error(`Timed out; frames=${JSON.stringify(sockets.map((s) => s.frames))}`);
  }
  function connect(name, query = "") {
    const ws = new WebSocket(`${web.url.replace("http:", "ws:")}/api/sessions/${sessionId}/terminals/${name}/ws${query}`, { headers: { Origin: web.url } });
    const socket = { ws, frames: [], code: undefined, httpStatus: undefined };
    ws.on("message", (data) => { const frame = JSON.parse(String(data)); socket.frames.push(frame); console.log(JSON.stringify({ name, query, frame })); });
    ws.on("close", (code) => { socket.code = code; });
    ws.on("unexpected-response", (_, response) => { socket.httpStatus = response.statusCode; response.resume(); ws.terminate(); });
    ws.on("error", () => {});
    sockets.push(socket);
    return socket;
  }
  async function snapshot(socket) {
    await until(() => socket.frames.some((frame) => frame.type === "snapshot"));
    return socket.frames.find((frame) => frame.type === "snapshot");
  }
  try {
    sessionId = (await client.request("createSession", { target: "owned" })).session.sessionId;
    const first = connect("shell");
    const initial = await snapshot(first);
    assert.equal(typeof initial.generation, "string");
    first.ws.send(JSON.stringify({ type: "input", data: "printf 'GEN_%s\\n' 'KEPT'\r" }));
    await until(() => first.frames.some((frame) => frame.type === "stdout" && frame.data.includes("GEN_KEPT")));
    first.ws.close();
    await until(() => first.code !== undefined);
    const second = connect("shell", `?generation=${encodeURIComponent(initial.generation)}`);
    const retained = await snapshot(second);
    assert.equal(retained.generation, initial.generation);
    assert.match(retained.replay, /GEN_KEPT/u);
    const wrong = connect("shell", "?generation=retired-generation");
    await until(() => wrong.code !== undefined);
    assert.equal(wrong.code, 4000);
    assert(!wrong.frames.some((frame) => frame.type === "snapshot"));
    const absent = connect("missing", `?generation=${encodeURIComponent(initial.generation)}`);
    await until(() => absent.code !== undefined);
    assert.equal(absent.code, 4000);
    assert(!absent.frames.some((frame) => frame.type === "snapshot"));
    assert.deepEqual((await client.request("terminalsList", { sessionId })).terminals.map((t) => t.name), ["shell"]);
    for (const query of ["?generation=", "?generation=x&generation=y", "?unknown=x"]) {
      const invalid = connect("shell", query);
      await until(() => invalid.httpStatus !== undefined);
      assert.equal(invalid.httpStatus, 400);
    }
    await client.request("terminalClose", { sessionId, name: "shell" });
    await until(() => second.code === 4000);
    const stale = connect("shell", `?generation=${encodeURIComponent(initial.generation)}`);
    await until(() => stale.code !== undefined);
    assert.equal(stale.code, 4000);
    assert.deepEqual((await client.request("terminalsList", { sessionId })).terminals, []);
    const explicit = await snapshot(connect("shell"));
    assert.notEqual(explicit.generation, initial.generation);
    console.log("PASS real API/WS generation: explicit create, subscribe-only retention, mismatch/missing terminal rejection, no implicit replacement, explicit new generation");
  } finally {
    for (const socket of sockets) socket.ws.terminate();
    if (sessionId) await client.request("terminalClose", { sessionId, name: "shell" }).catch(() => {});
    await web.close(); await adapter.close(); await owner.stop();
    await rm(root, { recursive: true, force: true });
  }
}, { allowHidden: true });
