// This check owns its target fixture (a local daemon under its own directory); the Gateway and web children run with
// an owned PRK_HOME.
import { lstat, mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export async function assembleLiveEnvironment(ctx) {
Object.defineProperties(ctx, {
    connectGateway: { configurable: true, get: () => connectGateway, set: (value) => { connectGateway = value; } },
    MAX_SUBMISSIONS: { configurable: true, get: () => MAX_SUBMISSIONS },
    SUBMISSION_TIMEOUT_MS: { configurable: true, get: () => SUBMISSION_TIMEOUT_MS },
    STARTUP_TIMEOUT_MS: { configurable: true, get: () => STARTUP_TIMEOUT_MS },
    projectRoot: { configurable: true, get: () => projectRoot },
    entry: { configurable: true, get: () => entry },
    fixtureSignal: { configurable: true, get: () => fixtureSignal, set: (value) => { fixtureSignal = value; } },
    values: { configurable: true, get: () => values },
    controlled: { configurable: true, get: () => controlled },
    PLAYWRIGHT: { configurable: true, get: () => PLAYWRIGHT },
    CHROMIUM: { configurable: true, get: () => CHROMIUM },
    evidenceDir: { configurable: true, get: () => evidenceDir },
    sleep: { configurable: true, get: () => sleep },
    bounded: { configurable: true, get: () => bounded },
    runtimeRoot: { configurable: true, get: () => runtimeRoot, set: (value) => { runtimeRoot = value; } },
    evidence: { configurable: true, get: () => evidence, set: (value) => { evidence = value; } },
    failure: { configurable: true, get: () => failure, set: (value) => { failure = value; } },
    browser: { configurable: true, get: () => browser, set: (value) => { browser = value; } },
    context: { configurable: true, get: () => context, set: (value) => { context = value; } },
    page: { configurable: true, get: () => page, set: (value) => { page = value; } },
    web: { configurable: true, get: () => web, set: (value) => { web = value; } },
    ui: { configurable: true, get: () => ui, set: (value) => { ui = value; } },
    apiPort: { configurable: true, get: () => apiPort, set: (value) => { apiPort = value; } },
    gateway: { configurable: true, get: () => gateway, set: (value) => { gateway = value; } },
    sentinel: { configurable: true, get: () => sentinel, set: (value) => { sentinel = value; } },
    runtimeEnv: { configurable: true, get: () => runtimeEnv, set: (value) => { runtimeEnv = value; } },
    socket: { configurable: true, get: () => socket, set: (value) => { socket = value; } },
    config: { configurable: true, get: () => config, set: (value) => { config = value; } },
    baselineKernelIds: { configurable: true, get: () => baselineKernelIds, set: (value) => { baselineKernelIds = value; } },
    runtimeKernelIds: { configurable: true, get: () => runtimeKernelIds, set: (value) => { runtimeKernelIds = value; } },
    fixtureRoot: { configurable: true, get: () => fixtureRoot, set: (value) => { fixtureRoot = value; } },
    overallTimer: { configurable: true, get: () => overallTimer },
});

let connectGateway;

const MAX_SUBMISSIONS = 4;

const SUBMISSION_TIMEOUT_MS = 180_000;

const STARTUP_TIMEOUT_MS = 60_000;

const projectRoot = fileURLToPath(new URL("../../..", import.meta.url));

const entry = fileURLToPath(new URL("../../../src/main.ts", import.meta.url));

const OVERALL_TIMEOUT_MS = 20 * 60_000;

let fixtureSignal;

const { values } = parseArgs({
  options: {
    help: { type: "boolean" },
    model: { type: "string" },
    home: { type: "string" },
    extension: { type: "string", multiple: true },
    controlled: { type: "boolean" },
    "evidence-dir": { type: "string" },
  },
});

if (values.help) {
  console.log("Usage: node tests/web/check-web-model-live.mjs (--model PROVIDER/MODEL --home DIR | --controlled) [--extension PATH ...] [--evidence-dir DIR]\nPaid mode requires an existing isolated credential home; no real-home fallback. Its agent/ must contain provider-owned config (e.g. cliproxyapi.json) alongside auth/models/settings/packages. This process overrides inherited PI_CODING_AGENT_DIR with <home>/agent. --controlled uses one owned temporary PRK home and a zero-cost provider; it is not real-model evidence. Requires PI_TEST_PLAYWRIGHT and PI_TEST_CHROMIUM.");
  process.exit(0);
}

const controlled = values.controlled === true;

if (!controlled && !values.model?.includes("/")) throw new Error("Specify --model PROVIDER/MODEL (or --controlled for the built-in zero-cost provider); no model fallback is permitted.");

if (!controlled && !values.home) throw new Error("Specify --home with an isolated credential home; no real-home fallback is permitted.");

if (!controlled && !(await stat(resolve(values.home))).isDirectory()) throw new Error("--home must be an existing isolated credential directory.");

const PLAYWRIGHT = process.env.PI_TEST_PLAYWRIGHT;

const CHROMIUM = process.env.PI_TEST_CHROMIUM;

if (!PLAYWRIGHT || !CHROMIUM) throw new Error("Set PI_TEST_PLAYWRIGHT and PI_TEST_CHROMIUM to run the web model acceptance.");

const evidenceDir = values["evidence-dir"] ? resolve(values["evidence-dir"]) : await mkdtemp(join(tmpdir(), "pi-web-model-live-evidence-"));

await mkdir(evidenceDir, { recursive: true });

console.log(`Evidence directory: ${evidenceDir}`);

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const bounded = async (promise, label, milliseconds) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), milliseconds); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

let runtimeRoot;

let evidence = {
  mode: controlled ? "controlled-provider; not real-model evidence" : "real-model",
  overallTimeoutMs: OVERALL_TIMEOUT_MS,
  model: controlled ? "gateway-check/controlled" : values.model,
  home: values.home,
  extension: values.extension,
  playwright: PLAYWRIGHT,
  chromium: CHROMIUM,
  bind: { host: "127.0.0.1", port: "ephemeral" },
  submissions: [],
  submissionAttempts: [],
  providerExchanges: "Not instrumented; worker submissions are not provider API call counts",
  phases: {},
  screenshots: [],
  browserRequests: [],
  browserErrors: [],
  cleanup: {},
};

let failure;

let browser;

let context;

let page;

let web;

let ui;

let apiPort;

let gateway;

let sentinel;

let runtimeEnv;

let socket;

let config;

let baselineKernelIds;

let runtimeKernelIds;

let fixtureRoot;

const overallTimer = setTimeout(() => process.emit("SIGTERM"), OVERALL_TIMEOUT_MS);

}
