import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { fauxProvider } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { startGateway } from "../../../src/gateway/socket-server/start-listener.ts";
import { rawGateway } from "./open-raw-gateway.mjs";
import { connectWebGateway } from "../../../src/http/gateway-connection/connect-gateway.ts";
import { startWebServer } from "../../../src/http/listener/start-listener.ts";

export async function checkRouteOnlyHistory() {
  const directory = await mkdtemp(join(tmpdir(), "route-only-history-"));
  const models = await ModelRuntime.create({ authPath: join(directory, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "route-history", models: [{ id: "controlled", reasoning: true }] });
  models.registerNativeProvider(provider.provider);
  let host, endpoint, transport, http, client;
  try {
    const path = join(directory, "saved.jsonl");
    await writeFile(path, "");
    const manager = SessionManager.open(path, directory, process.cwd());
    manager.appendSessionInfo("Saved session");
    const sessionId = manager.getSessionId();
    manager.appendCustomEntry("gateway-session-binding", { version: 4, target: "fixture", cwd: process.cwd(), sessionId });
    manager.appendMessage({ role: "user", content: "SAVED_HISTORY", timestamp: Date.now() });
    host = await createGatewayHost({ cwd: process.cwd(), home: directory, historyDir: directory, model: "route-history/controlled", targets: [] }, {
      runtimeDependencies: { model: provider.getModel("controlled"), modelRuntime: models, thinkingLevel: "off", cwd: process.cwd(), agentDir: directory },
    });
    const socket = join(directory, "gateway.sock");
    endpoint = await startGateway(host, socket);
    client = await rawGateway(socket);
    transport = await connectWebGateway({ socket });
    http = await startWebServer(transport, { port: 0 });
    const read = async (suffix, body) => {
      const response = await fetch(`${http.url}/api/sessions/${encodeURIComponent(sessionId)}/${suffix}`, {
        method: body === undefined ? "GET" : "POST", body: body === undefined ? undefined : JSON.stringify(body),
        headers: { Origin: http.url, "Content-Type": "application/json" }, signal: AbortSignal.timeout(10_000),
      });
      return { status: response.status, body: await response.json() };
    };
    const history = await read("history");
    assert.equal(history.status, 200);
    assert.equal(history.body.session.sessionId, sessionId);
    assert.equal(history.body.readOnly, true);
    assert.deepEqual(history.body.snapshot.messages.map(({ content }) => content), ["SAVED_HISTORY"]);
    assert.equal((await read("native")).body.target.sessionId, sessionId);
    for (const [index, method] of ["history", "nativeCapabilities", "nativeAction", "toolContent"].entries()) {
      const params = { worker: "saved-route", sessionId, ...(method === "nativeAction" ? { requestId: "old-selector", action: "session" } : method === "toolContent" ? { toolCallId: "missing" } : {}) };
      client.send({ v: 1, id: index + 1, method, params });
      await client.waitForFrames(index + 1, `Gateway rejects ${method} historical selector`);
      const frame = client.frames[index];
      assert.equal(frame.id, index + 1);
      assert.equal(frame.ok, false);
      assert.equal(frame.error.code, "INVALID_REQUEST");
    }
    for (const suffix of [`history?sessionId=${sessionId}`, `native?sessionId=${sessionId}`, `tool-content?sessionId=${sessionId}&toolCallId=missing`]) {
      assert.equal((await read(suffix)).status, 400);
    }
    assert.equal((await read("native", { requestId: "old-selector", action: "session", sessionId })).status, 400);
    assert.equal((await read("native", { requestId: "retired-resume", action: "resume", args: { sessionId } })).body.status, "unavailable");
    assert.equal(host.state(sessionId).state, "closed", "Read and rejected selection never start a runtime");
    assert.equal(provider.state.callCount, 0);
  } finally {
    await http?.close();
    if (client && !client.socket.destroyed) {
      await new Promise((resolve) => { client.socket.once("close", resolve); client.socket.destroy(); });
    }
    await transport?.close();
    await endpoint?.close();
    await host?.close();
    await rm(directory, { recursive: true, force: true });
  }
}
