import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { WebSocket } from "ws";
import { createPtyBrowserFixture } from "./create-fixture.mjs";

const fixture = await createPtyBrowserFixture();
const id = fixture.sessions[0].sessionId;
const socket = new WebSocket(`${fixture.url.replace("http:", "ws:")}/api/sessions/${id}/terminals/timeout-human/ws`, { headers: { Origin: fixture.url } });
let closeCode;
socket.on("close", (code) => { closeCode = code; });
try {
  const snapshot = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Human PTY snapshot timed out")), 10000);
    socket.on("error", reject);
    socket.on("message", (raw) => { const value = JSON.parse(String(raw)); if (value.type === "snapshot") { clearTimeout(timer); resolve(value); } });
  });
  const old = fixture.identities.find((entry) => entry.generation === snapshot.generation);
  assert.ok(old);
  const result = await fixture.runModelCommand(id, { name: "timeout-human", text: "trap '' INT; while :; do sleep 1; done", timeout_s: 0.2, yield_s: 10 });
  assert.equal(result.result.status, "killed");
  assert.equal(result.before.generation, snapshot.generation);
  assert.notEqual(result.after.generation, snapshot.generation);
  assert.equal(result.after.name, "timeout-human");
  assert.equal(result.after.owner, undefined);
  assert.equal(closeCode, 4000);
  const oldStat = await readFile(`/proc/${old.pid}/stat`, "utf8").catch((error) => { if (error.code === "ENOENT") return null; throw error; });
  assert.equal(oldStat, null, "independent observer confirms the replaced shell is absent");
  const current = fixture.identities.find((entry) => entry.generation === result.after.generation);
  assert.ok(current); assert.notEqual(current.pid, old.pid);
  const stat = await readFile(`/proc/${current.pid}/stat`, "utf8");
  assert.equal(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19], current.start);
  console.log(JSON.stringify({ fixture: "F3-timeout", old, current, result, closeCode, status: "PASS" }));
} finally { socket.terminate(); await fixture.close(); console.log("cleanup:complete"); }
