import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createPtyBrowserFixture } from "./create-fixture.mjs";

const fixture = await createPtyBrowserFixture();
let socket;
try {
  const get = async (path) => {
    const response = await fetch(`${fixture.url}${path}`, { signal: AbortSignal.timeout(10000) });
    const body = await response.json();
    assert.equal(response.status, 200, `${path}: ${JSON.stringify(body)}`);
    console.log(JSON.stringify({ path, status: response.status, body }));
    return body;
  };
  const models = await get("/api/models");
  assert.equal(models.defaultModel, "s3-owned/controlled");
  assert.ok(models.models.some((model) => model.value === models.defaultModel));
  const abort = new AbortController();
  const deadline = setTimeout(() => abort.abort(new Error("F2 workbench snapshot timeout")), 10000);
  let reader;
  try {
    const response = await fetch(`${fixture.url}/api/sessions/events`, { signal: abort.signal });
    assert.equal(response.status, 200);
    reader = response.body.getReader();
    let text = "";
    while (!text.includes("\n\n")) { const result = await reader.read(); assert.equal(result.done, false); text += new TextDecoder().decode(result.value); }
    const frame = text.split("\n\n")[0];
    assert.match(frame, /^event: snapshot/m);
    const snapshot = JSON.parse(frame.split("\n").find((line) => line.startsWith("data: ")).slice(6));
    assert.deepEqual(snapshot.sessions.map((entry) => entry.sessionId).sort(), fixture.sessions.map((entry) => entry.sessionId).sort());
    assert.equal(snapshot.targets[0].id, "owned");
    assert.ok(snapshot.sessions.every((entry) => entry.state === "idle" && entry.recovery === undefined), "New sessions start idle without a recovery record");
    console.log(JSON.stringify({ path: "/api/sessions/events", snapshot, status: "PASS" }));
  } finally { clearTimeout(deadline); await reader?.cancel(); abort.abort(); }
  for (const { sessionId } of fixture.sessions) {
    const state = await get(`/api/sessions/${sessionId}`);
    assert.equal(state.sessionId, sessionId); assert.equal(state.state, "idle");
    const history = await get(`/api/sessions/${sessionId}/history`);
    assert.equal(history.session.sessionId, sessionId); assert.equal(history.readOnly, true);
  }
  const sessionId = fixture.sessions[0].sessionId;
  socket = new WebSocket(`${fixture.url.replace("http:", "ws:")}/api/sessions/${sessionId}/terminals/app-shell/ws`, { headers: { Origin: fixture.url } });
  const snapshot = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("F2 terminal snapshot timeout")), 10000);
    socket.on("error", reject);
    socket.on("message", (raw) => { const message = JSON.parse(String(raw)); if (message.type === "snapshot") { clearTimeout(timer); resolve(message); } });
  });
  assert.equal(snapshot.name, "app-shell"); assert.equal(snapshot.cleanup, "linux-pdeathsig");
  const response = await fetch(`${fixture.url}/api/sessions/${sessionId}/terminals/close`, { method: "POST", headers: { Origin: fixture.url, "Content-Type": "application/json" }, body: JSON.stringify({ name: "app-shell" }) });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { closed: true });
  console.log(JSON.stringify({ fixture: "F2", nativeSessionId: sessionId, terminalGeneration: snapshot.generation, status: "PASS" }));
} finally { socket?.terminate(); await fixture.close(); console.log("cleanup:complete"); }
