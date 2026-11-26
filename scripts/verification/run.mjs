import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const node = process.execPath;
const npm = process.env.npm_execpath;
const totalStarted = performance.now();
const mode = process.argv[2];
if (!npm || !["test", "check"].includes(mode)) throw new Error("Use npm test or npm run check");
const required = ["PI_TEST_PYTHON", "PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"];
if (mode === "check" && required.some((name) => !process.env[name])) {
  throw new Error(`Set ${required.join(", ")}; see docs/kernel-recovery.md#test-environment`);
}
const scratch = await mkdtemp(join(tmpdir(), "prk-v-"));
const reporter = "./scripts/verification/report-cases.mjs";
const webResolver = "./scripts/verification/resolve-web-sources.mjs";
const cases = (layer, seconds, concurrency) => run(layer, node, ["--import", webResolver, "--test", `--test-concurrency=${concurrency}`, `--test-reporter=${reporter}`, `test/${layer}/**/*.test.mjs`], seconds);
try {
  const fast = await Promise.all([
    cases("unit", 30, 4),
    run("typecheck", node, ["node_modules/typescript/bin/tsc", "--noEmit"], 59),
    run("web typecheck", node, ["node_modules/typescript/bin/tsc", "-p", "web/tsconfig.json"], 59),
    run("web lint", node, [npm, "--prefix", "web", "run", "lint"], 59),
    run("contract lint", node, ["scripts/verification/lint-contract.mjs"], 59),
  ]);
  const fastInBudget = summarize("npm test", 60);
  const fastPassed = fast.every(Boolean) && fastInBudget;
  const full = mode === "check" && fastPassed ? await Promise.all([
    cases("integration", 180, 4),
    cases("browser", 300, 3),
    run("web build", node, [npm, "--prefix", "web", "run", "build"], 300),
  ]) : [];
  const fullInBudget = mode !== "check" || summarize("npm run check", 600);
  if (!fastPassed || !full.every(Boolean) || !fullInBudget) process.exitCode = 1;
} finally {
  await rm(scratch, { recursive: true, force: true });
}

function summarize(label, budget) {
  const seconds = (performance.now() - totalStarted) / 1000;
  console.log(`${label}: ${seconds.toFixed(2)}s / ${budget}s${seconds >= budget ? " OVER BUDGET" : ""}`);
  return seconds < budget;
}

async function run(label, command, args, budget) {
  const started = performance.now();
  const folder = await mkdtemp(join(scratch, "layer-"));
  const [home, temp, prk] = ["h", "t", "p"].map((name) => join(folder, name));
  await Promise.all([home, temp, prk].map((path) => mkdir(path)));
  const env = {
    PATH: process.env.PATH, LANG: "C.UTF-8", SHELL: "/bin/bash", HOME: home, PRK_HOME: prk, TMPDIR: temp,
    XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR, DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS,
    PI_OFFLINE: "1", PYTHONDONTWRITEBYTECODE: "1", ...Object.fromEntries(required.map((key) => [key, process.env[key]])),
  };
  const child = spawn(command, args, { cwd: root, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  const timings = [];
  let output = "", pending = "", expired = false;
  child.stderr.on("data", (chunk) => { output += chunk; });
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    const lines = (pending + chunk).split("\n");
    pending = lines.pop();
    for (const line of lines) {
      if (line.startsWith("PRK_CASE ")) timings.push(JSON.parse(line.slice(9)));
      else output += `${line}\n`;
    }
  });
  const timer = setTimeout(() => { expired = true; signalGroup(child, "SIGTERM"); }, budget * 1000);
  const killed = setTimeout(() => signalGroup(child, "SIGKILL"), budget * 1000 + 2000);
  let code;
  try {
    code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
  } finally {
    clearTimeout(timer);
    clearTimeout(killed);
    if (expired) signalGroup(child, "SIGKILL");
  }
  const seconds = (performance.now() - started) / 1000;
  const over = expired || seconds > budget;
  const passed = code === 0 && !over;
  console.log(`${passed ? "PASS" : "FAIL"} ${label}: ${seconds.toFixed(2)}s / ${budget}s${over ? " OVER BUDGET" : ""}${code !== 0 ? ` (exit ${code})` : ""}`);
  const slowest = timings.sort((a, b) => b.ms - a.ms).slice(0, 10);
  for (const { name, ms, status, note } of [...slowest, ...timings.slice(10).filter(({ status }) => status !== "PASS")]) {
    console.log(`  ${(ms / 1000).toFixed(3)}s  ${status}  ${name}${note ? ` — ${note}` : ""}`);
  }
  if (!passed) console.error(output + pending);
  return passed;
}

function signalGroup(child, signal) {
  if (!child.pid) return;
  try { process.kill(-child.pid, signal); }
  catch (error) { if (error.code !== "ESRCH") throw error; }
}
