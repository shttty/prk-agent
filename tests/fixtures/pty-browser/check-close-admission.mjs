import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { createPtyBrowserFixture } from "./create-fixture.mjs";

const bodyBytes = 128;
const fixture = await createPtyBrowserFixture({ http: { bodyBytes } });
const sessionId = fixture.sessions[0].sessionId;
const name = `close-admission-${"x".repeat(144)}`;
let socket;
try {
  const postFile = async (operation, body) => {
    const response = await fetch(`${fixture.url}/api/sessions/${sessionId}/files/${operation}`, { method: "POST", headers: { Origin: fixture.url, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const target = fixture.sessions[0].target;
  const listing = await postFile("list", { target });
  assert.equal(listing.status, 200, JSON.stringify(listing));
  assert.equal(listing.body.path, fixture.sessions[0].cwd);
  assert.ok(listing.body.entries.some((entry) => entry.path === fixture.sampleFile.path));
  const content = await postFile("read", { target, path: fixture.sampleFile.path });
  assert.equal(content.status, 200, JSON.stringify(content));
  assert.equal(content.body.content, fixture.sampleFile.content);
  const mismatch = await postFile("list", { target: "other" });
  assert.equal(mismatch.status, 400, JSON.stringify(mismatch));
  assert.equal(mismatch.body.details.reason, "target-mismatch");
  console.log(JSON.stringify({ fixture: "F3-files", listing, content, mismatch, status: "PASS" }));
  const opened = await fixture.openModel(sessionId, name);
  const identity = fixture.identities.find((entry) => entry.generation === opened.generation);
  const frames = [];
  socket = new WebSocket(`${fixture.url.replace("http:", "ws:")}/api/sessions/${sessionId}/terminals/${name}/ws?generation=${opened.generation}`, { headers: { Origin: fixture.url } });
  socket.on("message", (raw) => frames.push(JSON.parse(String(raw))));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Admission fixture snapshot timeout")), 10000);
    socket.on("error", reject);
    socket.on("message", () => { if (frames.some((frame) => frame.type === "snapshot")) { clearTimeout(timer); resolve(); } });
  });
  const body = JSON.stringify({ name });
  assert.ok(Buffer.byteLength(body) > bodyBytes);
  const response = await fetch(`${fixture.url}/api/sessions/${sessionId}/terminals/close`, { method: "POST", headers: { Origin: fixture.url, "Content-Type": "application/json" }, body });
  const failure = await response.json();
  assert.equal(response.status, 413, JSON.stringify(failure));
  const listed = await (await fetch(`${fixture.url}/api/sessions/${sessionId}/terminals`)).json();
  assert.equal(listed.terminals.find((entry) => entry.name === name).generation, opened.generation);
  assert.equal(socket.readyState, WebSocket.OPEN);
  const marker = randomUUID();
  socket.send(JSON.stringify({ type: "input", data: `printf '\\nSTILL_LIVE_%s\\n' '${marker}'\r` }));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Rejected close stopped PTY input")), 10000);
    socket.on("message", () => { if (frames.some((frame) => frame.type === "stdout" && frame.data.includes(`STILL_LIVE_${marker}`))) { clearTimeout(timer); resolve(); } });
  });
  const stat = await readFile(`/proc/${identity.pid}/stat`, "utf8");
  assert.equal(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19], identity.start);
  assert.equal(frames.some((frame) => frame.type === "closed"), false);
  console.log(JSON.stringify({ fixture: "F3-close-admission", bodyBytes, requestBytes: Buffer.byteLength(body), response: { status: response.status, failure }, identity, sameGeneration: opened.generation, inputMarker: marker, status: "PASS" }));
} finally { socket?.terminate(); await fixture.close(); console.log("cleanup:complete"); }
