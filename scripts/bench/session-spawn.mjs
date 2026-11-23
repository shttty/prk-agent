#!/usr/bin/env node
// Opt-in benchmark, deliberately outside check:quick/full. See --help for measurement boundaries.
import assert from "node:assert/strict";
import { runScenarios } from "./session-spawn/run-scenarios.mjs";
import { runWorkerScenario } from "./session-spawn/run-worker-scenario.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const help = `SHELL=/bin/bash PI_TEST_PYTHON=/path/to/python node scripts/bench/session-spawn.mjs --out DIR
Options: --samples N (>=5, default 5), --cycles N (>=20, default 20), --scenario local|remote/code|direct/off|on
         --smoke (one sample/cycle, development only; never a benchmark result)
Owned local/shell daemons only. Isolated HOME, PRK home and target caches.
No paid provider, production PRK inputs, network model access, upstream patching or service restart.
Remote native-on is an explicitly labelled post-spawn native-action + reload supplement: current
PRK defaults cannot spawn a remote child native-on. First actual context and post-reload context are separate.
Gateway RSS is this process (real embedded Gateway + small benchmark harness), not target children.
Kernel dispatch starts when faux emits kernel_code; ready ends at first Python statement after scope/prelude.
Host deploy starts at remoteExtensions.platform; process start at remoteExtensions.start; ready at registration.
Asset bytes count decoded assetChunk payloads; wire bytes count UTF-8 target-channel writes, not WebSocket/IP.
No forced GC. Retained-child RSS (N idle children) and sequential completed/destroyed RSS are separate.
Output: machine.json, one JSON per scenario, JSONL progress; summary.json with median/max/count per metric.
`;
const args = process.argv.slice(2);
if (args.includes("--help")) { console.log(help); process.exit(0); }
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const smoke = args.includes("--smoke");
const samples = smoke ? 1 : Number(option("--samples", 5));
const cycles = smoke ? 1 : Number(option("--cycles", 20));
assert(Number.isInteger(samples) && samples >= (smoke ? 1 : 5));
assert(Number.isInteger(cycles) && cycles >= (smoke ? 1 : 20));
assert(process.env.PI_TEST_PYTHON, "PI_TEST_PYTHON required");
assert.equal(process.env.SHELL, "/bin/bash");
const out = resolve(option("--out", `session-spawn-${Date.now()}`));
await mkdir(out, { recursive: true });
const ns = () => process.hrtime.bigint();
const ms = (start, end = ns()) => Number(end - start) / 1e6;
const sleep = (n) => new Promise((done) => setTimeout(done, n));
async function until(check, label) {
  const deadline = Date.now() + 60000;
  do { if (await check()) return; await sleep(10); } while (Date.now() < deadline);
  throw new Error(`Timeout: ${label}`);
}
const text = (message) => typeof message?.content === "string" ? message.content
  : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const jsonFile = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + "\n");

if (!args.includes("--worker")) await runScenarios({ args, out, smoke, samples, cycles, help, option, jsonFile, scriptURL: import.meta.url });
else await runWorkerScenario({ option, out, smoke, samples, cycles, ns, ms, sleep, until, text, jsonFile });
