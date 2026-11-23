import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { join } from "node:path";

const mode = process.argv[2] ?? "local";
assert(["local", "office"].includes(mode), `Unknown admission check mode: ${mode}`);
const home = await mkdtemp("/tmp/prk-s04-");
const temp = join(home, "tmp");
const env = { HOME: home, PRK_HOME: join(home, "prk"), TMPDIR: temp, XDG_RUNTIME_DIR: temp,
  PRK_CODING_AGENT_DIR: join(home, "prk", "agent"), PI_CODING_AGENT_DIR: join(home, "prk", "agent") };
let target, fixture, failing;
try {
  await mkdir(env.TMPDIR);
  Object.assign(process.env, env);
  delete process.env.JUPYTER_URL;
  delete process.env.JUPYTER_TOKEN;
  const { checkFrameRouting } = await import("./fixtures/check-frame-routing.mjs");
  // Even the explicit office mode uses a local, controlled runner for this portion.
  const routing = await checkFrameRouting(home, process.env.PI_TEST_PYTHON ?? "/usr/bin/python3");

  const { Type } = await import("typebox");
  const { ArtifactStore } = await import("../../src/artifacts/store/assemble-store.ts");
  const { kernelPrelude } = await import("../../src/codemode/kernel-prelude/build-prelude.ts");
  const { DEFAULT_KERNEL_OPTIONS } = await import("../../src/config/kernel/kernel-options.ts");
  const { initializePrkHome } = await import("../../src/config/home/initialize-prk-home.ts");
  const { createTarget } = await import("./fixtures/create-target.mjs");
  const { createSession } = await import("./fixtures/create-session.mjs");
  const { createBridgeDeployment } = await import("./fixtures/create-bridge-deployment.mjs");
  target = await createTarget(mode);
  initializePrkHome(process.env.PRK_HOME);
  const binary = Buffer.from("#!/bin/sh\n#" + "x".repeat(1536 * 1024) + "\nprintf 'OWNED_BINARY_OK\\n'\n");
  const hash = createHash("sha256").update(binary).digest("hex");
  const binDir = join(target.home, "assets");
  await new ArtifactStore(binDir).upload("s4-probe", "1.0.0", "x86_64", Readable.from(binary), hash);
  // tool_bin resolves deployed metadata; executable bytes travel through target deployment, not the cell callback.
  const targetCacheRoot = join(target.root, "target-cache");
  const deployment = await createBridgeDeployment(target, binDir, targetCacheRoot);
  try { await deployment.transfer(await deployment.read("s4-probe")); }
  finally { await deployment.close(); }
  const tools = [
    { name: "large", label: "large", description: "Large typed callback.", exposure: "codemode", parameters: Type.Object({}), execute: async () => ({ content: [], structuredContent: "😀".repeat(300000) }) },
    { name: "too_large", label: "too_large", description: "Bounded rejection.", exposure: "codemode", parameters: Type.Object({}), execute: async () => ({ content: [], structuredContent: "x".repeat(3 * 1024 * 1024) }) },
  ];
  fixture = await createSession(target, { tools, hooks: { binDir, prelude: () => kernelPrelude({ targetCacheRoot }) } });
  const transferred = await fixture.run(`import subprocess,hashlib\nfrom pathlib import Path\np=tool_bin('s4-probe')\nassert hashlib.sha256(Path(p).read_bytes()).hexdigest() == '${hash}'\nassert subprocess.check_output([p]).strip() == b'OWNED_BINARY_OK'\nassert len(gateway.large()) == 300000\nprint('CHUNKED_CALLBACKS_OK')`);
  assert.equal(Boolean(transferred.result.isError), false, transferred.text);
  const identity = fixture.owner.getSnapshot().kernelId;
  const oversized = await fixture.run("gateway.too_large()");
  assert.equal(Boolean(oversized.result.isError), true, oversized.text);
  assert.match(oversized.text, /exceeds process message budget/);
  assert.equal(fixture.owner.getSnapshot().kernelId, identity);
  assert.equal(Boolean((await fixture.run("assert len(gateway.large()) == 300000")).result.isError), false);
  let initializations = 0;
  failing = await createSession(target, { hooks: { prelude: async (scoped) => {
    initializations++;
    if (initializations === 1) return "raise RuntimeError('OWNED_INIT_FAILURE')";
    return kernelPrelude({ kernel: { ...DEFAULT_KERNEL_OPTIONS, scoped } });
  } } });
  const failed = await failing.run("open('bare-cell.txt','w').write('BAD')");
  assert.equal(Boolean(failed.result.isError), true, failed.text);
  assert.match(failed.text, /OWNED_INIT_FAILURE/);
  await Promise.all([failing.owner.ensure(), failing.owner.ensure()]);
  assert.equal(initializations, 2, "retired cleanup and startup share the same single-flight");
  const recovered = await failing.run("import os\nassert not os.path.exists('bare-cell.txt')\nassert callable(gateway.describe)");
  assert.equal(Boolean(recovered.result.isError), false, recovered.text);
  const before = failing.owner.getSnapshot().kernelId;
  const reset = failing.owner.tool.execute("owned-reset", { code: "reset_marker=41", reset: true });
  await assert.rejects(failing.owner.tool.execute("owned-reset-two", { code: "reset_marker=0", reset: true }), { code: "BUSY" });
  await reset;
  assert.equal(initializations, 3);
  assert.notEqual(failing.owner.getSnapshot().kernelId, before);
  assert.match((await failing.run("reset_marker")).text, /41/);
  console.log(JSON.stringify({ status: "PASS", mode, binaryBytes: binary.length, hash, initializations, concurrentResetRejected: true, ...routing }));
} finally {
  try { await failing?.close(); }
  finally {
    try { await fixture?.close(); }
    finally {
      try { await target?.close(); }
      finally { await rm(home, { recursive: true, force: true }); }
    }
  }
}
