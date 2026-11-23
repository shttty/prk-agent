import { stringify } from "smol-toml";
import assert from "node:assert/strict";
import { lstat, mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { initializePrkHome } from "../../../src/config/home/initialize-prk-home.ts";

export async function checkLiveRecovery(ctx) {
try {
  ctx.runtimeRoot = await mkdtemp(join(tmpdir(), "pi-web-model-live-"));
  const home = ctx.controlled ? ctx.runtimeRoot : resolve(ctx.values.home);
  if (ctx.controlled) await mkdir(join(home, "agent"));
  initializePrkHome(home);
  // SDK bootstrap boundary: static imports would run before this owned home exists.
  ({ connectGateway: ctx.connectGateway } = await import("../../../src/gateway/socket-client/connect-client.ts"));
  const { createPythonTool } = await import("../../../src/kernel/assemble-kernel.ts");
  const { withTargetFixture } = await import("../../fixtures/target-fixture.mjs");
  const { startWebDev } = await import("../../fixtures/web-dev.mjs");
  const { readPrkConfigDocument } = await import("../../../src/config/document/read-prk-config-document.ts");
  const { chromium } = await import(pathToFileURL(resolve(ctx.PLAYWRIGHT)).href);
  await withTargetFixture(async (fixture) => {
    ctx.config = fixture.config;
    ctx.fixtureSignal = fixture.signal;
    ctx.fixtureRoot = fixture.tempRoot;
    fixture.onCleanup(async () => {
      try {
        await ctx.cleanupProcesses();
        ctx.evidence.cleanup.completed = true;
      } catch (error) {
        ctx.evidence.cleanup.completed = false;
        ctx.evidence.cleanup.failure = ctx.sanitizeError(error);
        throw error;
      }
    });
    ctx.socket = join(ctx.runtimeRoot, "gateway.sock");
    // Under the fixture directory, so one /proc scan sees the sentinel and both sessions' REPL processes.
    const targetCwd = join(fixture.tempRoot, "sameenv-cwd");
    await mkdir(targetCwd);
    const configPath = join(home, "config.toml");
    const document = await readPrkConfigDocument(configPath) ?? {};
    await writeFile(configPath, stringify({ ...document, session: { ...document.session, workerTools: "direct" } }));
    await writeFile(join(home, "instances.toml"), stringify({ instances: [{
      name: "sameenv",
      label: "Live instance",
      tags: [],
      ...ctx.config,
      cwd: targetCwd,
      executionTimeoutMs: ctx.SUBMISSION_TIMEOUT_MS,
    }] }), { mode: 0o600 });
    ctx.runtimeEnv = { ...process.env, PRK_HOME: home, PYTHONDONTWRITEBYTECODE: "1" };
    const model = ctx.controlled ? "gateway-check/controlled" : ctx.values.model;
    const extensions = ctx.controlled
      ? [fileURLToPath(new URL("../../fixtures/gateway-test-provider.mjs", import.meta.url))]
      : (ctx.values.extension ?? []).map((path) => resolve(path));
    // Same as check-gateway-live: skills and context files never load, so a run only depends on the model and extensions given.
    const gatewayArgs = ["--home", home, "--no-skills", "--model", model];
    for (const extension of extensions) gatewayArgs.push("--extension", extension);
    ctx.evidence.applicationArgs = ["gateway", "--socket", "[owned-runtime]/gateway.sock", "--no-skills", "--model", model, "--home", ctx.controlled ? "[owned-runtime]" : home, ...extensions.flatMap((extension) => ["--extension", extension])];

    ctx.sentinel = createPythonTool({ ...fixture.runtime, target: "live-acceptance-sentinel" });
    await ctx.bounded(ctx.sentinel.tool.execute("sentinel", { code: "sentinel_value = 73\nprint(sentinel_value)" }, fixture.signal), "sentinel kernel", 30_000);
    ctx.baselineKernelIds = await ctx.kernelIds();
    assert.equal(ctx.baselineKernelIds.length, 1, "The owned fixture must begin with exactly one unrelated sentinel REPL process.");

    ctx.gateway = await ctx.startGateway(ctx.socket, ctx.runtimeEnv, gatewayArgs);
    ctx.web = await ctx.startWeb(ctx.socket, ctx.runtimeEnv);
    // The UI dev server outlives the API restarts below; each restarted API
    // listener comes back on this port, where the UI's /api proxy points.
    ctx.apiPort = Number(new URL(ctx.web.url).port);
    ctx.ui = await startWebDev(ctx.web.url);
    ctx.evidence.phases.gatewayStarted = ctx.safeProcessRecord(ctx.gateway);
    ctx.evidence.phases.webStarted = { ...ctx.safeProcessRecord(ctx.web), url: ctx.web.url, ui: ctx.ui.url };

    ctx.browser = await chromium.launch({ executablePath: ctx.CHROMIUM, headless: true, args: ["--no-sandbox"] });
    ctx.context = await ctx.browser.newContext({ viewport: { width: 1440, height: 1000 } });
    ctx.page = await ctx.context.newPage();
    ctx.page.setDefaultTimeout(30_000);
    ctx.page.on("pageerror", (error) => { ctx.evidence.browserErrors = [...ctx.evidence.browserErrors, error.message]; });
    ctx.page.on("response", (response) => {
      const url = response.url();
      if (url.includes("/api/") || url.includes("/events")) ctx.evidence.browserRequests = [...ctx.evidence.browserRequests, { method: response.request().method(), path: new URL(url).pathname, status: response.status() }];
    });
    await ctx.page.goto(ctx.ui.url, { waitUntil: "domcontentloaded" });
    await ctx.waitForWorkbenchReady(ctx.page);
    await ctx.page.locator('button[data-action="create-session"]').first().waitFor({ state: "visible" });

    const sessions = [await ctx.createSession(ctx.page, 1), await ctx.createSession(ctx.page, 2)].at(-1);
    assert.equal(sessions.length, 2);
    const seedValues = new Map([[sessions[0], 41], [sessions[1], 99]]);
    const initial = {};
    for (const sessionId of sessions) {
      const value = seedValues.get(sessionId);
      const sent = await ctx.sendFromBrowser(ctx.page, sessionId, value, "seed");
      initial[sessionId] = { sessionId: sent.state.sessionId, kernelId: sent.state.kernel.kernelId };
    }
    ctx.runtimeKernelIds = await ctx.kernelIds();
    assert.equal(ctx.runtimeKernelIds.length, ctx.baselineKernelIds.length + 2, "Seed operations must start exactly two Gateway-owned REPL processes.");
    assert(ctx.baselineKernelIds.every((pid) => ctx.runtimeKernelIds.includes(pid)), "The sentinel REPL is untouched by seeding.");
    assert.equal(new Set(Object.values(initial).map(({ kernelId }) => kernelId)).size, 2, "Same-environment sessions must have independent runtimes.");
    ctx.evidence.phases.seed = { sessions, initial, kernelIds: ctx.runtimeKernelIds };
    await ctx.page.screenshot({ path: join(ctx.evidenceDir, "desktop-seed.png"), fullPage: true, animations: "disabled" });


    await ctx.stopProcess(ctx.web);
    ctx.evidence.phases.webBeforeGatewayCrash = ctx.safeProcessRecord(ctx.web);
    ctx.web = undefined;
    const kernelsBeforeGatewayCrash = await ctx.kernelIds();
    const crashedGateway = ctx.gateway;
    const ownedSocket = await lstat(ctx.socket);
    assert(ownedSocket.isSocket());
    await ctx.stopProcess(crashedGateway, "SIGKILL");
    assert.equal(crashedGateway.child.signalCode, "SIGKILL", "The exact owned Gateway OS process has exited before socket cleanup");
    ctx.evidence.phases.gatewayCrashed = ctx.safeProcessRecord(crashedGateway);
    ctx.gateway = undefined;
    // SIGKILL bypasses Gateway endpoint cleanup. This path is owned by this
    // fixture, and the old process is confirmed exited before removing it.
    const staleSocket = await lstat(ctx.socket);
    assert(staleSocket.isSocket() && staleSocket.dev === ownedSocket.dev && staleSocket.ino === ownedSocket.ino, "Refuse to remove a replaced or unrelated socket");
    await rm(ctx.socket);
    assert.equal(await ctx.exists(ctx.socket), false, "The crashed Gateway endpoint must be removed before its owned restart.");
    ctx.evidence.phases.ownedStaleSocketRemoved = { afterPidExit: crashedGateway.child.pid, sameDeviceAndInode: true };
    // The Gateway's REPLs end with it (the target daemon is tied to its owner); the unrelated sentinel stays.
    await ctx.waitFor(async () => JSON.stringify(await ctx.kernelIds()) === JSON.stringify(ctx.baselineKernelIds), "Gateway SIGKILL ends exactly its own REPL processes", 20_000);

    ctx.gateway = await ctx.startGateway(ctx.socket, ctx.runtimeEnv, gatewayArgs);
    const kernelsAfterGatewayRestart = await ctx.kernelIds();
    assert.deepEqual(kernelsAfterGatewayRestart, ctx.baselineKernelIds, "Gateway startup must start no REPL.");
    ctx.web = await ctx.startWeb(ctx.socket, ctx.runtimeEnv, ctx.apiPort);
    ctx.evidence.phases.gatewayRestarted = { ...ctx.safeProcessRecord(ctx.gateway), kernelsBeforeHistory: kernelsAfterGatewayRestart };
    ctx.evidence.phases.webAfterGatewayRestart = { ...ctx.safeProcessRecord(ctx.web), url: ctx.web.url };
    await ctx.page.goto(ctx.ui.url, { waitUntil: "domcontentloaded" });
    await ctx.page.setViewportSize({ width: 1440, height: 1000 });
    await ctx.waitForWorkbenchReady(ctx.page);
    const historyStates = {};
    for (const sessionId of sessions) {
      const current = await ctx.browserJson(ctx.page, "/api/workbench");
      const listed = current.sessions.find((entry) => entry.sessionId === sessionId);
      assert.equal(listed?.state, "closed", "Gateway restart must expose archived sessions before explicit recovery.");
      const recovered = await ctx.recoverFromBrowser(ctx.page, sessionId);
      historyStates[sessionId] = recovered;
      // Nothing is adopted: the recovered session runs a new runtime whose namespace lacks the seeded value.
      const sent = await ctx.sendFromBrowser(ctx.page, sessionId, seedValues.get(sessionId), "gateway");
      assert.notEqual(sent.state.kernel.kernelId, initial[sessionId].kernelId, "Recovery after a Gateway loss starts a new runtime");
    }
    const kernelsAfterRecovery = await ctx.kernelIds();
    assert.equal(kernelsAfterRecovery.length, ctx.baselineKernelIds.length + 2, "Each recovered session runs exactly one new REPL process.");
    assert(!kernelsAfterRecovery.some((pid) => ctx.runtimeKernelIds.includes(pid) && !ctx.baselineKernelIds.includes(pid)), "No pre-crash REPL process is reused.");
    ctx.evidence.phases.gatewayHistory = { historyReadOnly: true, kernelsAfterRestart: kernelsAfterGatewayRestart, sessions: historyStates, noStartupAllocations: true, noHistorySubmissions: true };
    assert.deepEqual(ctx.evidence.submissions.map(({ phase }) => phase), ["seed", "seed", "gateway", "gateway"]);
    assert.equal(ctx.evidence.submissions.length, ctx.MAX_SUBMISSIONS);
    assert.deepEqual(ctx.evidence.browserErrors, [], "Live browser acceptance must have no page errors.");
    await ctx.page.screenshot({ path: join(ctx.evidenceDir, "desktop-gateway-recovered.png"), fullPage: true, animations: "disabled" });
    ctx.evidence.screenshots = [...ctx.evidence.screenshots, "desktop-gateway-recovered.png"];

    await ctx.stopProcess(ctx.web);
    ctx.evidence.phases.webFinalStopped = ctx.safeProcessRecord(ctx.web);
    ctx.web = undefined;
    ctx.evidence.phases.finalKernelIdsBeforeShutdown = await ctx.kernelIds();
    ctx.evidence.cleanup.requested = "Gateway shutdown after browser proof";
  });
  ctx.evidence.result = "PASS";
} catch (error) {
  ctx.failure = ctx.sanitizeError(error);
  ctx.evidence.result = "FAIL";
  ctx.evidence.failure = ctx.failure;
  if (ctx.gateway) {
    ctx.evidence.phases.gatewayAtFailure = {
      process: ctx.safeProcessRecord(ctx.gateway),
      socketPresent: ctx.socket ? await ctx.exists(ctx.socket).catch(() => false) : false,
      diagnostics: ctx.sanitizeError(new Error(ctx.gateway.stderr.trim().slice(-4_000))),
    };
  }
} finally {
  clearTimeout(ctx.overallTimer);
  // Also remove the owned home if initialization/imports fail before fixture cleanup is registered.
  if (ctx.runtimeRoot) await ctx.cleanupProcesses();
  ctx.evidence.cleanup.fixtureTempRemoved = ctx.fixtureRoot ? !(await ctx.exists(ctx.fixtureRoot)) : true;
  ctx.evidence.observedWorkerSubmissions = ctx.evidence.submissionAttempts.length;
  ctx.evidence.observedPaidWorkerSubmissions = ctx.controlled ? 0 : ctx.evidence.submissionAttempts.length;
  await ctx.writeEvidence("evidence.json", ctx.evidence);
  if (ctx.failure) {
    await ctx.writeEvidence("failure.json", { result: "FAIL", failure: ctx.failure, phases: ctx.evidence.phases, cleanup: ctx.evidence.cleanup });
    console.error(`FAIL live browser acceptance: ${ctx.failure}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS live browser acceptance: ${join(ctx.evidenceDir, "evidence.json")}`);
  }
}
}
