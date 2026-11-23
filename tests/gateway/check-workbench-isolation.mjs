import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";

// Real persisted SDK files → Gateway child Unix socket → HTTP; only the provider is faux.
if (process.env.JUPYTER_URL !== undefined || process.env.JUPYTER_TOKEN !== undefined) throw new Error("Unset JUPYTER_URL/JUPYTER_TOKEN: this integration requires its own Jupyter fixture.");
const root = await mkdtemp(join(tmpdir(), "wbi-"));
process.env.PRK_HOME = root;
initializePrkHome(root);
const evidence = resolve(process.env.PI_TEST_WEB_EVIDENCE ?? ".smart-cascade/control/workbench-isolation");
await mkdir(evidence, { recursive: true });
const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
const { createIsolationSessions } = await import("../fixtures/workbench-isolation/create-sessions.mjs");
const { withIsolationGateway } = await import("../fixtures/workbench-isolation/with-gateway.mjs");
const scenarios = [
  { name: "active-derived", kind: "derived", archived: false, location: "active", field: "/phase" },
  { name: "archived-derived", kind: "derived", archived: true, location: "archived", field: "/destroyDelegates" },
  { name: "active-native-state", kind: "native", archived: false, location: "active", field: "/autoRetry" },
  { name: "startup-archive-state", kind: "archive", archived: false, location: "unknown", field: "/group" },
  { name: "startup-missing-identity", kind: "header", archived: false, location: "unknown", field: "session id" },
];
try {
  await withTargetFixture(async ({ config, tempRoot, owned, onCleanup }) => {
    assert.equal(owned, true);
    for (const [index, scenario] of scenarios.entries()) {
      const home = join(root, String(index));
      await mkdir(home);
      const sessions = await createIsolationSessions(home, tempRoot, scenario);
      const { good, bad, archivedGood } = sessions;
      const { result: issue, stderr } = await withIsolationGateway({ root: home, config, cwd: tempRoot, directory: sessions.directory, evidence, name: scenario.name, onCleanup }, async ({ apiUrl }) => {
        const request = async (path, method = "GET") => {
          const response = await fetch(new URL(path, apiUrl), {
            method, signal: AbortSignal.timeout(30000),
            ...(method === "POST" ? { headers: { Origin: apiUrl, "Content-Type": "application/json" }, body: "{}" } : {}),
          });
          return { status: response.status, data: await response.json() };
        };
        const first = await request("/api/workbench");
        await writeFile(join(evidence, `${scenario.name}.workbench.json`), JSON.stringify(first, null, 2));
        assert.equal(first.status, 200, `${scenario.name}: one unreadable session cannot fail the workbench: ${JSON.stringify(first.data)}`);
        assert(first.data.sessions.some((entry) => entry.sessionId === good.sessionId), "Healthy active entry survives projection");
        if (archivedGood) assert(first.data.archive.flatMap((group) => group.sessions).some((entry) => entry.sessionId === archivedGood.sessionId), "A healthy member of the corrupt session's archive group survives");
        assert(Array.isArray(first.data.unreadableSessions), "Workbench always publishes the unreadableSessions collection");
        assert.equal(first.data.unreadableSessions.length, 1);
        const unreadable = bad.sessionId === undefined
          ? first.data.unreadableSessions.find((entry) => entry.sessionFile === bad.sessionFile) : first.data.unreadableSessions[0];
        assert(unreadable, "The unreadable file has its own diagnostic");
        if (bad.sessionId === undefined) assert.equal(Object.hasOwn(unreadable, "sessionId"), false, "A file without native identity never receives an invented sessionId");
        else {
          assert.equal(unreadable.sessionId, bad.sessionId);
          assert.equal(Object.hasOwn(unreadable, "name"), false);
        }
        assert.equal(unreadable.sessionFile, bad.sessionFile);
        assert.equal(unreadable.location, scenario.location);
        assert(unreadable.reason.includes(scenario.field), `Schema failures include ${scenario.field}: ${unreadable.reason}`);
        const healthy = await request(`/api/sessions/${good.sessionId}/history`);
        assert.equal(healthy.status, 200);
        assert.equal(healthy.data.snapshot.sessionId, good.sessionId);
        assert(JSON.stringify(healthy.data.snapshot.messages).includes("ISOLATION_HEALTHY_HISTORY"));
        for (const [action, method] of bad.sessionId === undefined ? [] : [["history", "GET"], ["wake", "POST"]]) {
          const failed = await request(`/api/sessions/${bad.sessionId}/${action}`, method);
          assert(failed.status >= 400, `${action} must explicitly fail for unreadable data`);
          assert.equal(typeof failed.data.error, "string");
          assert(failed.data.error.includes(scenario.field), `${action} retains the field-level cause: ${JSON.stringify(failed.data)}`);
          assert(failed.data.error.includes(unreadable.reason), `${action} reports the same cause as workbench`);
        }
        if (process.argv.includes("--browser")) {
          const { checkIsolationBrowser } = await import("../fixtures/workbench-isolation/check-browser.mjs");
          await checkIsolationBrowser({ apiUrl, good, bad, scenario, evidence });
        }
        for (let poll = 0; poll < 3; poll++) {
          const repeated = await request("/api/workbench");
          assert.equal(repeated.status, 200);
          assert(repeated.data.sessions.some((entry) => entry.sessionId === good.sessionId));
          assert.deepEqual(repeated.data.unreadableSessions, first.data.unreadableSessions);
        }
        assert.equal((await request(`/api/sessions/${good.sessionId}/history`)).status, 200, "Bad operations leave healthy history available");
        return unreadable;
      });
      const reports = stderr.split(/\r?\n/).filter((line) => line.includes(bad.sessionId ?? bad.sessionFile));
      assert.equal(reports.length, 1, `${scenario.name}: genuine Gateway stderr reports the session exactly once across startup, operations, browser and repeated polls: ${stderr}`);
      assert(reports[0].includes(bad.sessionFile) && reports[0].includes(issue.reason), "The warning line contains the session file and complete field-level cause");
      assert.equal(await readFile(bad.sessionFile, "utf8"), bad.bytes, "Unreadable data is never repaired or rewritten");
      await assert.rejects(readFile(join(home, "provider-calls")), (error) => error.code === "ENOENT", "Observation and refused wake never call the faux provider");
      console.log(`PASS ${scenario.name}: isolated HTTP 200, ${bad.sessionId === undefined ? "file-only diagnosis" : "field-level operation failures"}, one stderr warning${process.argv.includes("--browser") ? ", real browser unreadable row" : ""}`);
    }
  }, { allowHidden: true });
} finally {
  await rm(root, { recursive: true, force: true });
}
