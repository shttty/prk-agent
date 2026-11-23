import { assembleBrowserWorkbench } from "./workbench-interactions/assemble-browser-workbench.mjs";
import { checkCreationAndInstanceEdit } from "./workbench-interactions/check-creation-and-instance-edit.mjs";
import { checkMessageOrderAndNotices } from "./workbench-interactions/check-message-order-and-notices.mjs";
import { checkKernelAndAttachments } from "./workbench-interactions/check-kernel-and-attachments.mjs";
import { checkSelectionAndWebRestart } from "./workbench-interactions/check-selection-and-web-restart.mjs";
import { checkProviderOutcomes } from "./workbench-interactions/check-provider-outcomes.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { request as httpRequest } from "node:http";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { verifySessionPresentationPersistence } from "./web-mobile-checks.mjs";
// Real acceptance path, in one run:
//
//   browser -> HTTP/SSE web client adapter -> Gateway/Agent host with the
//   embedded Pi SDK -> the Gateway's own REPL processes on an owned local target.
//
// The web process is only a client: it holds no SDK, no model, no worker and no
// kernel. Only provider responses are controlled; everything else (sessions,
// kernels, Python state, HTTP, SSE, DOM) is real. Playwright is an optional
// test runtime.
const playwrightPath = process.env.PI_TEST_PLAYWRIGHT;
const executablePath = process.env.PI_TEST_CHROMIUM;
const webHost = process.env.PI_TEST_WEB_HOST ?? "127.0.0.1";
if (!playwrightPath || !executablePath) throw new Error("Set PI_TEST_PLAYWRIGHT to playwright-core/index.mjs and PI_TEST_CHROMIUM to an installed Chromium executable.");
const { chromium } = await import(pathToFileURL(resolve(playwrightPath)).href);
const evidence = resolve(process.env.PI_TEST_WEB_EVIDENCE ?? ".smart-cascade/control/web-browser-check");
const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const webEntry = fileURLToPath(new URL("../../src/main.ts", import.meta.url));
await mkdir(evidence, { recursive: true });
const PROVIDER_DIAGNOSTIC_MARKER = "web-workbench-provider-diagnostic-v1";
const DIAGNOSTIC_CHILD_ENV = "PI_WEB_WORKBENCH_DIAGNOSTIC_CHILD";
const text = (result) => typeof result?.content === "string" ? result.content : (result?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");

/** Start the actual primary web adapter (the /api backend) as an OS child process. */
const startWebProcess = (socket, port = 0) => new Promise((resolveProcess, rejectProcess) => {
  const child = spawn(process.execPath, [webEntry, "web", "--socket", socket, "--host", webHost, "--port", String(port)], {
    cwd: projectRoot,
    env: { ...process.env, PRK_HOME: dirname(socket) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  let settled = false;
  const timer = setTimeout(() => finish(new Error(`Timed out starting the primary web adapter. ${stderr}`)), 30_000);
  child.stdout.resume();
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
    const ready = /Web client ready at (https?:\/\/[^;\s]+)/.exec(stderr);
    if (ready) finish(undefined, { child, url: ready[1], stderr });
  });
  const finish = (error, value) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    child.removeListener("error", onError);
    child.removeListener("exit", onExit);
    if (error) {
      child.kill("SIGKILL");
      rejectProcess(new Error(`${error.message} ${stderr}`));
    } else resolveProcess(value);
  };
  const onError = (error) => finish(error);
  const onExit = (code, signal) => finish(new Error(`Primary web adapter exited before readiness (code=${code}, signal=${signal}).`));
  child.once("error", onError);
  child.once("exit", onExit);
});

const stopWebProcess = async (handle) => {
  if (!handle) return;
  const { child } = handle;
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
  child.kill("SIGTERM");
  let timeout;
  await Promise.race([exited, new Promise((resolveTimeout) => { timeout = setTimeout(resolveTimeout, 10_000); })]);
  clearTimeout(timeout);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
};
const prompt = (code) => `**请用 Python 执行以下代码**，不要重试不确定的操作。\n\`\`\`python\n${code}\n\`\`\`\n\n<img src=x onerror=alert(1)><span class="evil">raw user HTML</span>`;
const wait = async (predicate, description, timeout = 45_000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error(`Timed out: ${description}`);
};
async function captureOriginalWorkbenchDiagnostics() {
  // The browser child owns its process group (target fixture, Gateway, daemon, browser): a hard timeout stops it all.
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
      cwd: projectRoot,
      env: { ...process.env, [DIAGNOSTIC_CHILD_ENV]: "1" },
      // detached makes the self-launched browser test the verified owner of its process group.
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-200_000); });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-200_000); });
    const closed = new Promise((resolveClosed, rejectClosed) => {
      child.once("error", rejectClosed);
      child.once("close", (code, signal) => resolveClosed({ code, signal }));
    });
    const signalOwnedGroup = (signal) => {
      if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
      try { process.kill(-child.pid, signal); } catch (error) { if (error?.code !== "ESRCH") throw error; }
    };
    let stopping;
    const stop = () => stopping ??= (async () => {
      if (child.exitCode !== null || child.signalCode !== null) { await closed; return; }
      signalOwnedGroup("SIGTERM");
      let stopTimer;
      const stopped = await Promise.race([closed.then(() => true), new Promise((resolveStopped) => { stopTimer = setTimeout(() => resolveStopped(false), 15_000); })]);
      clearTimeout(stopTimer);
      if (!stopped) signalOwnedGroup("SIGKILL");
      await closed;
    })();
    const forwardSignal = () => { void stop(); };
    process.once("SIGTERM", forwardSignal);
    process.once("SIGINT", forwardSignal);
    let timer;
    try {
      const result = await Promise.race([closed, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Timed out running the original web workbench browser process.")), 180_000); })]);
      assert.equal(result.code, 0, `Original web workbench process failed (signal=${result.signal}). stdout=${stdout} stderr=${stderr}`);
      assert.match(stderr, new RegExp(PROVIDER_DIAGNOSTIC_MARKER));
      for (const diagnostic of ["provider_transport_failure", "fixtureTransport", '"requestBytes":321']) {
        assert(stderr.includes(diagnostic), `Gateway diagnostics retain ${diagnostic}`);
      }
      process.stdout.write(stdout);
    } finally {
      process.removeListener("SIGTERM", forwardSignal);
      process.removeListener("SIGINT", forwardSignal);
      clearTimeout(timer);
      await stop();
    }
}

const runOriginalWorkbench = async () => {
  await withTargetFixture(async ({ config, runtime, signal, onCleanup, tempRoot }) => {
const ctx = {
  get PROVIDER_DIAGNOSTIC_MARKER() { return PROVIDER_DIAGNOSTIC_MARKER; },
  get chromium() { return chromium; },
  get config() { return config; },
  get runtime() { return runtime; },
  get evidence() { return evidence; },
  get executablePath() { return executablePath; },
  get onCleanup() { return onCleanup; },
  get prompt() { return prompt; },
  get signal() { return signal; },
  get startWebProcess() { return startWebProcess; },
  get stopWebProcess() { return stopWebProcess; },
  get tempRoot() { return tempRoot; },
  get text() { return text; },
  get wait() { return wait; },
  get webHost() { return webHost; },
};
await assembleBrowserWorkbench(ctx);
await checkCreationAndInstanceEdit(ctx);
await checkMessageOrderAndNotices(ctx);
await checkKernelAndAttachments(ctx);
await checkSelectionAndWebRestart(ctx);
await checkProviderOutcomes(ctx);
});
};
if (process.env[DIAGNOSTIC_CHILD_ENV] === "1") await runOriginalWorkbench();
else await captureOriginalWorkbenchDiagnostics();
