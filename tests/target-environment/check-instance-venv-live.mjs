import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTargetEnvironments } from "../../src/target-environment/connection/assemble-environments.ts";
import { ensureVenv } from "../../src/target-environment/python/ensure-venv.ts";
import { managedPythonPaths } from "../../src/target-environment/python/managed-paths.ts";
import { pythonBootstrapRemote, runPythonBootstrapCommand } from "../../src/target-environment/python/run-python-bootstrap-command.ts";

const python = process.env.PI_TEST_PYTHON;
assert(python?.startsWith("/"), "PI_TEST_PYTHON must name a usable Python executable");
const uv = process.env.PI_TEST_UV;
assert(uv?.startsWith("/"), "PI_TEST_UV must name the pinned uv executable");
await access(uv);
const root = await mkdtemp(join(tmpdir(), "uvenv-venv-"));
const previousHome = process.env.HOME;
process.env.HOME = root;
const environments = createTargetEnvironments({ targetCacheRoot: join(root, "cache"), resolve: () => ({ local: true }) });
const paths = { ...managedPythonPaths(join(root, "cache"), "instance"), python, uv };
let environment;
try {
  environment = await environments.acquire("instance");
  await ensureVenv(environment, paths);
  const remote = pythonBootstrapRemote(environment);
  const marker = await runPythonBootstrapCommand(remote, environment.signal, [paths.venvPython, "-c",
    "import pathlib,sysconfig; (pathlib.Path(sysconfig.get_path('purelib'))/'prk_reuse_marker.py').write_text('value = 73\\n')"]);
  assert.equal(marker.exitCode, 0, marker.output);
  // An executable cached venv must not invoke uv again, even if uv is unavailable.
  await ensureVenv(environment, { ...paths, uv: join(root, "uv-must-not-run") });
  const reused = await runPythonBootstrapCommand(remote, environment.signal, [paths.venvPython, "-c",
    `import sys,prk_reuse_marker; assert prk_reuse_marker.value == 73; assert sys.executable == ${JSON.stringify(paths.venvPython)}; assert sys.prefix != sys.base_prefix`]);
  assert.equal(reused.exitCode, 0, reused.output);
  console.log("PASS instance venv: real offline uv creation and package-preserving cached reuse");
} finally {
  try { await environment?.release(); }
  finally {
    if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
    await rm(root, { recursive: true, force: true });
  }
}
