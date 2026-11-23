import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocket } from "ws";
import { createPtyBrowserFixture } from "../fixtures/pty-browser/create-fixture.mjs";

const fixture = await createPtyBrowserFixture();
const sessionId = fixture.sessions[0].sessionId;
const sockets = [];
async function until(predicate) {
  for (let i = 0; i < 500; i++) { if (predicate()) return; await delay(20); }
  throw new Error(`Timeout: ${JSON.stringify(sockets.map((s) => s.frames))}`);
}
function open(name, generation) {
  const query = generation === undefined ? "" : `?generation=${encodeURIComponent(generation)}`;
  const ws = new WebSocket(`${fixture.url.replace("http:", "ws:")}/api/sessions/${sessionId}/terminals/${name}/ws${query}`, { headers: { Origin: fixture.url } });
  const item = { ws, frames: [], code: undefined };
  ws.on("message", (raw) => { const frame = JSON.parse(String(raw)); item.frames.push(frame); console.log(JSON.stringify({ frame })); });
  ws.on("close", (code) => { item.code = code; });
  ws.on("error", () => {});
  sockets.push(item); return item;
}
try {
  let fresh;
  if (!process.argv.includes("--close-only")) {
  const first = open("human");
  await until(() => first.frames.some((frame) => frame.type === "snapshot"));
  const snapshot = first.frames.find((frame) => frame.type === "snapshot");
  first.ws.send(JSON.stringify({ type: "input", data: "printf 'REAL_PTY_%s\\n' 'β😀'\r" }));
  await until(() => first.frames.some((frame) => frame.type === "stdout" && frame.data.includes("REAL_PTY_β😀")));
  first.ws.close(); await until(() => first.code !== undefined);
  const resumed = open("human", snapshot.generation);
  await until(() => resumed.frames.some((frame) => frame.type === "snapshot"));
  assert.equal(resumed.frames.find((frame) => frame.type === "snapshot").generation, snapshot.generation);
  assert.match(resumed.frames.find((frame) => frame.type === "snapshot").replay, /REAL_PTY_β😀/u);
  const model = await fixture.openModel(sessionId);
  assert.equal(model.owner, "model");
  const list = await (await fetch(`${fixture.url}/api/sessions/${sessionId}/terminals`)).json();
  assert.deepEqual(list.terminals.map((entry) => entry.name).sort(), ["human", "model"]);
  await fixture.disconnectTarget();
  await until(() => resumed.code === 4000);
  const stale = open("human", snapshot.generation);
  await until(() => stale.code !== undefined);
  assert.equal(stale.code, 4000);
  fresh = open("human");
  await until(() => fresh.frames.some((frame) => frame.type === "snapshot"));
  assert.notEqual(fresh.frames.find((frame) => frame.type === "snapshot").generation, snapshot.generation);
  } else {
    fresh = open("human");
    await until(() => fresh.frames.some((frame) => frame.type === "snapshot"));
  }
  const close = await fetch(`${fixture.url}/api/sessions/${sessionId}/terminals/close`, { method: "POST", headers: { Origin: fixture.url, "Content-Type": "application/json" }, body: JSON.stringify({ name: "human" }) });
  assert.equal(close.status, 200, "D7 close confirms the owned shell exit");
  assert.deepEqual(await close.json(), { closed: true });
  await until(() => fresh.code === 4000);
  const gone = open("human", fresh.frames.find((frame) => frame.type === "snapshot").generation);
  await until(() => gone.code !== undefined); assert.equal(gone.code, 4000);
  console.log("PASS real candidate Gateway/socket/HTTP/PTY confirmed close and stale generation rejection");
} finally {
  for (const socket of sockets) socket.ws.terminate();
  await fixture.close();
}
