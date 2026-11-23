// IO/cross-boundary smoke: typecheck + web lint/build + parallel integration checks (~30 s guide).
// Ordinary edits use related pure unit cases + check:unit; ship-daily adds this smoke with --smoke.
// check:full runs every non-live integration sequentially, only when cutting version 0.1.
// Failure logs are printed at the end. QUICK_JOBS overrides the quick-mode parallelism.
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FAST_TESTS = [
  // config / workers
  "tests/workers/check-prk-config.mjs",
  "tests/workers/check-machine-config.mjs",
  "tests/workers/check-gateway-sdk-home.mjs",
  "tests/workers/check-worker-lifecycle.mjs",
  "tests/workers/check-independent-worker.mjs",
  // sessions
  "tests/sessions/check-session-host.mjs",
  "tests/sessions/check-worker-space.mjs",
  "tests/sessions/check-ask.mjs",
  "tests/sessions/check-plugin-config.mjs",
  "tests/sessions/check-native-interactions.mjs",
  "tests/sessions/check-native-sdk-resources.mjs",
  "tests/sessions/check-extension-filter.mjs",
  "tests/sessions/check-append-prompt.mjs",
  "tests/sessions/check-history-protocol.mjs",
  "tests/sessions/check-worker-history-storage.mjs",
  "tests/sessions/check-recovery-protocol.mjs",
  "tests/sessions/check-recovery-runtime.mjs",
  "tests/sessions/check-agent-reply-once.mjs",
  "tests/sessions/check-conversation-responsibility.mjs",
  "tests/sessions/check-agent-messaging.mjs",
  "tests/sessions/check-gateway-history.mjs",
  // gateway / http
  "tests/gateway/check-gateway-contract.mjs",
  "tests/gateway/check-host-live-observer.mjs",
  "tests/gateway/check-gateway-process-exit.mjs",
  "tests/gateway/check-absolute-cwd.mjs",
  "tests/web/check-web-gateway-client.mjs",
  "tests/web/check-tool-body-logic.mjs",
  "tests/web/check-attachments-logic.mjs",
  "tests/web/check-ask-logic.mjs",
  "tests/web/check-target-environment-logic.mjs",
  "tests/web/check-todo-widget-parse.mjs",
  "tests/workspace/check-terminal-output.mjs",
  "tests/monitor/check-monitor-service.mjs",
  "tests/target-environment/check-process-startup.mjs",
  "tests/web/check-monitor-logic.mjs",
  "tests/web/check-terminal-socket.mjs",
  "tests/web/check-extension-notifications.mjs",
  "tests/web/web-server-smoke.ts",
  "tests/web/check-gateway-restart.mjs",
  "tests/web/check-error-presentation.mjs",
  "tests/web/check-nested-tool-live.mjs",
  "tests/web/check-extension-ui-render-trigger.mjs",
  "tests/web/check-workspace-editor-logic.mjs",
  "tests/web/check-workbench-smoke.mjs",
  "tests/web/check-render-scope.mjs",
  "tests/web/check-message-overlays.mjs",
  "tests/web/check-https-proxy-origin.mjs",
  // owned target Python / code mode
  "tests/kernel/check-kernel-state.mjs",
  "tests/kernel/check-instance-python.mjs",
  "tests/kernel/check-kernel-trace.mjs",
  "tests/kernel/check-kernel-bridge.mjs",
  "tests/kernel/check-lifecycle.mjs",
];

const full = process.argv.includes("--full");
// Both runs include browser checks. Fail before starting the batch if the local test tools are unset.
const testEnv = ["PI_TEST_PYTHON", "PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"];
const missingEnv = testEnv.filter((name) => !process.env[name]);
if (missingEnv.length) {
  console.error(`check:${full ? "full" : "quick"}: set ${missingEnv.join(", ")} (see docs/kernel-recovery.md#test-environment)`);
  process.exit(2);
}
// Live suites need a paid model (or --model) and stay manual.
const ALL_TESTS = readdirSync("tests").filter((dir) => !dir.includes(".") && dir !== "fixtures")
  .flatMap((dir) => readdirSync(join("tests", dir)).filter((file) => /^check-.*\.mjs$|^web-server-smoke\.ts$/.test(file)).map((file) => `tests/${dir}/${file}`))
  .filter((file) => file.endsWith("/check-nested-tool-live.mjs") || !/-live\.mjs$/.test(file)).sort();
const jobs = full ? 1 : Number(process.env.QUICK_JOBS) || 6;
const started = Date.now();
const failures = [];

function run(label, command, args, options = {}) {
  return new Promise((resolve) => {
    const home = mkdtempSync(join(tmpdir(), "prk-quick-"));
    const child = spawn(command, args, { ...options, env: { ...process.env, PRK_HOME: home }, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const t0 = Date.now();
    child.on("close", (code) => {
      rmSync(home, { recursive: true, force: true });
      const seconds = ((Date.now() - t0) / 1000).toFixed(1);
      if (code === 0) console.log(`ok   ${seconds.padStart(5)}s  ${label}`);
      else { console.log(`FAIL ${seconds.padStart(5)}s  ${label}`); failures.push({ label, output }); }
      resolve();
    });
  });
}

const node = process.execPath;
const npx = join(process.execPath, "..", "npx");
// Slowest first (rough order from measured times), so the parallel batch finishes together.
const SLOW_FIRST = ["check-workbench-smoke.mjs", "check-kernel-bridge.mjs", "check-gateway-history.mjs", "check-agent-messaging.mjs", "check-instance-python.mjs"];
const ordered = [...FAST_TESTS].sort((a, b) => {
  const rank = (file) => { const index = SLOW_FIRST.findIndex((name) => file.endsWith(`/${name}`)); return index < 0 ? SLOW_FIRST.length : index; };
  return rank(a) - rank(b);
});
const queue = full ? [
  () => run("tsc", npx, ["tsc", "--noEmit", "-p", "."]),
  () => run("web build", "npm", ["run", "-s", "build"], { cwd: "web" }),
  () => run("web lint", "npm", ["run", "-s", "lint"], { cwd: "web" }),
  () => run("Pi UI probe declarations", "npm", ["run", "-s", "check:ui-probe"]),
  ...ALL_TESTS.map((file) => () => run(file, node, [file])),
] : [
  ...ordered.slice(0, SLOW_FIRST.length).map((file) => () => run(file, node, [file])),
  () => run("tsc", npx, ["tsc", "--noEmit", "-p", "."]),
  () => run("web build", "npm", ["run", "-s", "build"], { cwd: "web" }),
  () => run("web lint", "npm", ["run", "-s", "lint"], { cwd: "web" }),
  ...ordered.slice(SLOW_FIRST.length).map((file) => () => run(file, node, [file])),
];
await Promise.all(Array.from({ length: jobs }, async () => {
  while (queue.length) await queue.shift()();
}));

const total = ((Date.now() - started) / 1000).toFixed(1);
for (const { label, output } of failures) console.log(`\n── ${label} ──\n${output.split("\n").slice(-25).join("\n")}`);
console.log(`\n${failures.length ? `${failures.length} failed` : "all passed"} in ${total}s`);
process.exitCode = failures.length ? 1 : 0;
