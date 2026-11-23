import assert from "node:assert/strict";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const evidence = process.env.PRK_EVIDENCE;
const ready = JSON.parse(readFileSync(join(evidence, "ready.json"), "utf8"));
const counters = ["provider-calls.jsonl", "target-acquires.jsonl"];
const before = counters.map((name) => existsSync(join(evidence, name)) ? readFileSync(join(evidence, name), "utf8") : "");
assert.deepEqual(before, ["", ""], "Read-only rehearsal starts before any target or model request");
const response = await fetch(`${ready.api}/api/workbench`);
assert.equal(response.status, 200);
const workbench = await response.json();
assert.deepEqual(workbench.unreadableSessions ?? [], []);
const sessions = [...workbench.sessions, ...workbench.archive.flatMap((group) => group.sessions)];
assert.equal(sessions.length, 24, "All copied SDK histories appear in the managed or archived collection");
const observations = [];
for (const session of sessions) {
  const response = await fetch(`${ready.api}/api/sessions/${encodeURIComponent(session.sessionId)}/history`);
  assert.equal(response.status, 200, session.sessionId);
  const history = await response.json();
  observations.push({ sessionId: session.sessionId, state: session.state ?? "archived", historyKeys: Object.keys(history) });
}
const after = counters.map((name) => existsSync(join(evidence, name)) ? readFileSync(join(evidence, name), "utf8") : "");
assert.deepEqual(after, before, "History, sleeping and archived reads do not acquire a target or call a provider");
const result = { api: ready.api, home: ready.home, histories: observations, providerCalls: 0, targetAcquires: 0,
  managed: workbench.sessions.length, sleeping: workbench.sessions.filter((session) => session.state === "sleeping").length,
  archived: workbench.archive.reduce((count, group) => count + group.sessions.length, 0) };
writeFileSync(join(evidence, "history-no-wake.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ histories: sessions.length, providerCalls: 0, targetAcquires: 0, managed: result.managed, sleeping: result.sleeping, archived: result.archived }));
