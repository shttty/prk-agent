import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const root = await mkdtemp(join(tmpdir(), "prk-fallback-proof-"));
try {
  const resultFile = join(root, "result.json");
  const { stdout, stderr } = await promisify(execFileCallback)(process.execPath,
    [...process.execArgv, fileURLToPath(new URL("./sleepset/exercise-model-fallback.mjs", import.meta.url))],
    { env: { ...process.env, PI_TEST_SLEEPSET_FALLBACK_RESULT: resultFile }, maxBuffer: 1024 * 1024 });
  const result = JSON.parse(await readFile(resultFile, "utf8"));
  const logs = stderr.split("\n").filter((line) => line.includes(result.previousModel) && line.includes(result.model));
  assert.equal(logs.length, result.fallbackCount, "Gateway logs each actual model fallback once, including both provider/model specs");
  process.stdout.write(stdout);
  if (process.env.PI_TEST_WEB_EVIDENCE) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(process.env.PI_TEST_WEB_EVIDENCE, "model-fallback-stderr.log"), stderr);
  }
} finally { await rm(root, { recursive: true, force: true }); }
console.log("PASS unavailable model: visible default fallback, native model_change write-back, real default HTTP request, one log, no repeated fallback, asleep repair and explicit dismissal");
