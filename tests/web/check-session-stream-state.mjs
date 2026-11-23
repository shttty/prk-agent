import { stringify } from "smol-toml";
// Restart scenario adapted directly from check-extension-ui-gateway-restart.mjs of the earlier
// remote-extensions feature branch.
// Real Gateway OS processes + owned pi-env/REPL + Vite + Chromium; only the provider is faux.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { inspect } from "node:util";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { startSessionStreamTransport } from "../fixtures/session-stream-transport.mjs";
import { checkStreamScenarios } from "./session-stream/check-stream-scenarios.mjs";
import { launchStreamGateway } from "./session-stream/launch-stream-gateway.mjs";

for (const name of ["PI_TEST_PYTHON", "PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"]) assert(process.env[name], `${name} is required`);
const scenarioNames = ["restart", "reload", "reorder", "switch"];
const selected = new Set(process.argv.find((argument) => argument.startsWith("--scenarios="))?.slice(12).split(",") ?? scenarioNames);
assert(selected.size && [...selected].every((name) => scenarioNames.includes(name)), "Unknown scenario selection");
const repo = fileURLToPath(new URL("../..", import.meta.url));
const root = await mkdtemp(join(tmpdir(), "prk-stream-state-"));
const evidence = resolve(process.env.PRK_STREAM_STATE_EVIDENCE ?? process.env.PI_TEST_WEB_EVIDENCE ?? await mkdtemp(join(tmpdir(), "prk-stream-state-evidence-")));
await mkdir(evidence, { recursive: true });
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const until = async (read, accept, label, timeout = 20000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await read(); if (accept(value)) return value; await sleep(30); }
  throw new Error(`Timed out: ${label}`);
};
const record = { repo, status: "running", processes: [], pageErrors: [], scenarios: {}, screenshots: [] };
const logs = [];
let browser, page, web, ui, transport, child, client;
let releaseReconnect;
async function stop(signal = "SIGTERM") {
  if (!child) return;
  const current = child;
  child = undefined;
  if (current.process.exitCode === null && current.process.signalCode === null) current.process.kill(signal);
  let timer;
  try {
    await Promise.race([current.done, new Promise((_, reject) => { timer = setTimeout(() => { current.process.kill("SIGKILL"); reject(new Error("Owned Gateway did not stop")); }, 10000); })]);
  } finally { clearTimeout(timer); }
}
async function screenshot(name) {
  if (!page || page.isClosed()) return;
  const path = join(evidence, `${name}.png`);
  await page.screenshot({ path });
  const bytes = (await stat(path)).size;
  assert(bytes > 0, "Screenshot must exist and contain bytes");
  record.screenshots.push({ path, bytes });
}
async function scenario(name, body) {
  if (!selected.has(name)) return;
  const result = record.scenarios[name] = { status: "running", checks: [], errors: [] };
  const check = async (label, assertion) => {
    try { await assertion(); result.checks.push({ label, status: "passed" }); }
    catch (error) { result.checks.push({ label, status: "failed", error: error.stack }); result.errors.push(error.stack); }
  };
  try { await body(result, check); }
  catch (error) { result.errors.push(error.stack); }
  finally {
    await screenshot(`${name}-after`).catch((error) => result.errors.push(error.stack));
    await page?.close(); page = undefined;
    transport.release();
    result.status = result.errors.length ? "failed" : "passed";
    console.log(`SESSION_STREAM_${name.toUpperCase()}_${result.status.toUpperCase()}`);
  }
}
try {
  if (process.env.PRK_STREAM_BASELINE_RESTART_EVIDENCE) {
    assert(!selected.has("restart"), "Do not rerun an already observed baseline restart");
    const path = resolve(process.env.PRK_STREAM_BASELINE_RESTART_EVIDENCE);
    record.reusedRestartEvidence = { path, result: JSON.parse(await readFile(join(path, "result.json"), "utf8")) };
  }
  await withTargetFixture(async ({ config, tempRoot, onCleanup }) => {
    const releases = [];
    onCleanup(async () => {
      releaseReconnect?.();
      for (const path of releases) await writeFile(path, "release");
      await browser?.close();
      await client?.disconnect();
      await ui?.close();
      await transport?.close();
      await web?.close();
      await stop();
    });
    const home = join(root, "home");
    const { agentDir } = initializePrkHome(home);
    await mkdir(join(agentDir, "extensions"), { recursive: true });
    await writeFile(join(agentDir, "settings.json"), JSON.stringify({ defaultProjectTrust: "always", compaction: { enabled: false }, retry: { enabled: false } }));
    await writeFile(join(agentDir, "extensions/stream-state.js"), `export { registerStreamUi as default } from ${JSON.stringify(pathToFileURL(join(repo, "tests/fixtures/session-stream-state.mjs")).href)};\n`);
    const stageFile = join(root, "stage.json");
    const answerFile = join(root, "answers.jsonl");
    const stage = (name, bump) => writeFile(stageFile, JSON.stringify({ name, bump }));
    const socket = join(root, "gateway.sock");
    await writeFile(join(home, "config.toml"), stringify({
      gateway: { socketPath: socket }, targetCacheRoot: join(root, "target-cache"), monitor: { enabled: false }, memory: { enabled: false, review: false },
      session: { noExtensions: false, bootstrapNoSkills: true, workerTools: "direct", idleTimeoutMs: 600000 },
    }));
    await writeFile(join(home, "instances.toml"), stringify({ instances: [{ id: "stream", label: "Stream fixture", ...config, cwd: tempRoot }] }), { mode: 0o600 });
    const launch = (name, prepareArtifacts = true) => launchStreamGateway({ name, prepareArtifacts, repo, home, socket, root, stageFile, answerFile, logs, until, record, setChild: (value) => { child = value; }, setClient: (value) => { client = value; } });
    const state = (worker) => client.request("state", { sessionId: worker });
    async function create(name, bump = 1) {
      await stage(name, bump);
      const created = await client.request("createSession", { target: "stream", label: name });
      const catalog = await client.request("nativeCapabilities", { sessionId: created.session.sessionId });
      assert(catalog.commands.some((command) => command.name === "stream-status"), `Real UI fixture failed discovery: ${JSON.stringify(catalog.diagnostics)}`);
      const snapshot = await until(() => state(created.session.sessionId), (value) => value.extensionUi?.prompts.some((prompt) => prompt.kind === "confirm"), "real extension confirm");
      return { sessionId: created.session.sessionId, snapshot, prompt: snapshot.extensionUi.prompts.find((prompt) => prompt.kind === "confirm"), status: snapshot.extensionUi.status.find((entry) => entry.key === "stream-proof").text };
    }
    async function select(worker) {
      if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click();
      await page.locator(`[data-session-id="${worker}"] .management-session-select`).click();
      await page.locator(`[data-session-id="${worker}"][aria-current="true"]`).waitFor();
    }
    async function open(worker) {
      await page?.close();
      page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      page.setDefaultTimeout(10000);
      page.on("pageerror", (error) => record.pageErrors.push(error.message));
      await page.goto(ui.url);
      await select(worker);
    }
    const visibleUi = async ({ prompt, status }) => {
      await page.waitForFunction(({ id, status }) => document.querySelector(`[data-prompt-id="${id}"]`)?.checkVisibility() && document.querySelector('[data-status-key="stream-proof"]')?.textContent === status, { id: prompt.id, status }, { timeout: 10000 });
    };
    const native = (worker, args) => client.request("nativeAction", { sessionId: worker, requestId: randomUUID(), action: "extension-ui", args });
    async function streamOwnership(worker, snapshot) {
      assert.equal(typeof snapshot.streamId, "string");
      assert(snapshot.streamId);
      const frames = transport.frames.filter((frame) => frame.sessionId === worker && frame.data.streamId === snapshot.streamId);
      assert(frames.length > 0, "Browser transport must receive the actual stream identity");
      const first = frames[0];
      assert(first.event === "snapshot" || (first.event === "host" && first.data.type === "snapshot"), "A snapshot establishes replacement stream ownership before deltas");
      for (const frame of transport.frames.filter((frame) => frame.sessionId === worker && ["snapshot", "host"].includes(frame.event))) {
        assert.equal(typeof frame.data.streamId, "string");
        assert(frame.data.streamId, "Every snapshot and host delta has a nonempty identity");
      }
      const render = await native(worker, { operation: "render", width: 80, height: 40, clientId: "stream-owner-check" });
      assert.equal(render.status, "completed");
      assert.equal(render.data.streamId, snapshot.streamId, "Native HTTP render belongs to the same host stream");
    }
    async function oldAnswer(worker, previous, replacement, result, check) {
      result.stale = await page.evaluate(async ({ worker, id }) => {
        const response = await fetch(`/api/sessions/${worker}/native`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), action: "extension-ui", args: { operation: "dialog", id, value: true } }) });
        return { status: response.status, body: await response.json() };
      }, { worker, id: previous.prompt.id });
      const preserved = await state(worker);
      await check("old answer rejected", () => { assert.equal(result.stale.status, 200); assert.equal(result.stale.body.status, "unavailable"); });
      await check("old answer cannot consume new confirm", () => assert(preserved.extensionUi.prompts.some((prompt) => prompt.id === replacement.prompt.id)));
    }
    async function answer(current) {
      await page.locator(`[data-prompt-id="${current.prompt.id}"] [data-action="submit"]`).click();
      await until(() => readFile(answerFile, "utf8").catch((error) => { if (error.code === "ENOENT") return ""; throw error; }), (text) => text.split("\n").filter(Boolean).map((line) => JSON.parse(line)).some((item) => item.status === current.status && item.value === true), "new browser answer reaches current extension");
      await page.locator(`[data-prompt-id="${current.prompt.id}"]`).waitFor({ state: "detached" });
    }
    async function invoke(worker, message) {
      const accepted = await client.request("send", { sessionId: worker, requestId: randomUUID(), message });
      assert.equal(accepted.accepted, true);
      return until(() => state(worker), (value) => value.recentOperations.some((operation) => operation.operationId === accepted.operationId), "controlled command completion");
    }
    async function streaming(worker, token) {
      const release = join(tempRoot, `${token}.release`);
      releases.push(release);
      const message = JSON.stringify({ stream: token, code: `from pathlib import Path\nimport time\ndeadline = time.monotonic() + 90\nwhile not Path(${JSON.stringify(release)}).exists():\n    if time.monotonic() > deadline: raise TimeoutError('stream fixture release missing')\n    time.sleep(0.02)\nprint(${JSON.stringify(`${token}_RESULT`)})` });
      const accepted = await client.request("send", { sessionId: worker, requestId: randomUUID(), message });
      assert.equal(accepted.accepted, true);
      await until(() => transport.frames, (frames) => frames.some((frame) => frame.sessionId === worker && frame.event === "host" && frame.data.type === "session_event" && frame.data.details?.sdkType === "tool_execution_start"), "real tool start frame");
      return { accepted, release };
    }
    await stage("old", 80);
    const initialPid = await launch("old");
    web = await startWebApplication({ home, socket, host: "127.0.0.1", port: 0 });
    transport = await startSessionStreamTransport(web.server.url);
    ui = await startWebDev(transport.url);
    const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
    browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });

    await checkStreamScenarios({
      scenario, create, open, visibleUi, screenshot, stop, until, stage, launch, initialPid, socket,
      oldAnswer, streamOwnership, answer, transport, invoke, streaming, sleep, select, state,
      get page() { return page; },
      get client() { return client; }, set client(value) { client = value; },
      get releaseReconnect() { return releaseReconnect; }, set releaseReconnect(value) { releaseReconnect = value; },
    });
    assert.deepEqual(record.pageErrors, [], "Real browser must not report page errors");
    await writeFile(join(evidence, "frames.json"), JSON.stringify(transport.frames, null, 2));
  }, { tempParent: root });
  const failed = Object.values(record.scenarios).some((result) => result.status !== "passed") || record.reusedRestartEvidence?.result.status === "failed";
  record.status = failed ? "failed" : "passed";
  if (failed) process.exitCode = 1;
} catch (error) {
  record.status = "error";
  record.error = inspect(error, { depth: null });
  process.exitCode = 1;
} finally {
  await writeFile(join(evidence, "result.json"), JSON.stringify(record, null, 2));
  await writeFile(join(evidence, "gateway.log"), logs.join(""));
  await rm(root, { recursive: true, force: true });
  console.log(`SESSION_STREAM_STATE_${record.status.toUpperCase()} ${evidence}`);
}
