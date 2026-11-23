import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";

const python = process.env.PI_TEST_PYTHON;
assert(python && isAbsolute(python), "PI_TEST_PYTHON must name the absolute owned test interpreter");
const bootstrap = readFileSync(new URL("../../src/kernel/process/bootstrap.py", import.meta.url), "utf8");
const unit = `prk-kernel-${crypto.randomUUID()}.scope`;
// Padding makes this regression independent of the size of the bundled runner on Linux x86_64.
const source = `# ${"x".repeat(256 * 1024)}\nvalue = "$PRK_UNSET €"\n`;
const launcher = `
from pathlib import Path
import sys

def launch_python(configuration, source, forkserver_source):
    namespace = {}
    exec(compile(source, "<test runner>", "exec"), namespace)
    assert namespace["value"] == "$PRK_UNSET €"
    assert forkserver_source == "# $PRK_UNSET forkserver"
    assert Path("/proc/self/cgroup").read_text().strip().endswith("/" + configuration["scope"]["unit"])
    assert sys.stdin.buffer.readline() == b"first control frame\\n"
    print("SCOPED_BOOTSTRAP")
`;
const frame = JSON.stringify({ source, launcher, forkserverSource: "# $PRK_UNSET forkserver",
  configuration: { scope: { enabled: true, unit, memoryMax: "1G", memorySwapMax: "0" }, options: { startTimeoutMs: 10000 } } }) + "\n";
const launch = (maximum) => spawnSync(python, ["-I", "-u", "-c", bootstrap, String(maximum)], {
  // A single write may include control bytes; the bootstrap owns exactly one bounded line.
  input: frame + "first control frame\n", encoding: "utf8", timeout: 15000,
  env: { ...process.env, PRK_FORCE_UNSCOPED: "0" },
});
const frameBytes = Buffer.byteLength(frame);
const result = launch(frameBytes);
assert.ifError(result.error);
assert.equal(result.status, 0, result.stderr);
assert.equal(result.stdout, "SCOPED_BOOTSTRAP\n");
const oversized = launch(frameBytes - 1);
assert.ifError(oversized.error);
assert.equal(oversized.status, 1);
assert.equal(oversized.stdout, "");
assert.match(oversized.stderr, /Kernel bootstrap exceeds process frame budget/);
console.log("PASS scoped Python bootstrap: large in-memory deployment, exact frame limit and untouched control input");
