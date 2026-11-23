import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { DEFAULT_CODEMODE_OPTIONS } from "../../src/config/codemode/codemode-options.ts";
import { prepareRgArtifact } from "../fixtures/rg-artifact.mjs";
import { filetoolsContract, bashScenarios, globScenarios, grepScenarios } from "../fixtures/kernel-file-scenarios.mjs";

const home = await mkdtemp(join(tmpdir(), "prk-hashedit-"));
initializePrkHome(home);
const { kernelPrelude } = await import("../../src/codemode/kernel-prelude/build-prelude.ts");
const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
const { createFileKernel } = await import("../fixtures/file-kernel.mjs");
const text = (result) => result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
try {
  const { binDir, assetSha } = await prepareRgArtifact(home);
  await withTargetFixture(async ({ runtime, owned, tempRoot, onCleanup }) => {
    assert.equal(owned, true);
    // The memory/limit contract keeps its two fresh, small-limit SDK owners and runs before the warm shared kernel.
    await filetoolsContract({ runtime, owned, tempRoot, onCleanup, home });
    const owner = await createFileKernel({ ...runtime, cwd: tempRoot }, {
      codeMode: true, binDir,
      prelude: () => kernelPrelude({ moduleHome: home, kernelTools: { files: {} }, targetCacheRoot: join(home, "target-cache"), codemode: DEFAULT_CODEMODE_OPTIONS }),
    }, home, onCleanup);
    const unavailable = await createFileKernel({ ...runtime, cwd: tempRoot }, {
      codeMode: true, binDir: join(home, "missing-assets"),
      prelude: () => kernelPrelude({ moduleHome: home, kernelTools: { files: {} }, targetCacheRoot: join(home, "missing-target-cache"), codemode: DEFAULT_CODEMODE_OPTIONS }),
    }, home, onCleanup);
    const enter = async (kernel, group) => {
      const cwd = join(tempRoot, group);
      await mkdir(cwd, { recursive: true });
      const changed = await kernel.execute("scenario-cwd", { code: `__import__("os").chdir(${JSON.stringify(cwd)})`, title: "Isolate scenario files" });
      if (changed.isError) throw new Error(text(changed));
    };
    await enter(owner, "bash");
    await bashScenarios(owner);
    await enter(owner, "glob");
    await enter(unavailable, "glob");
    await globScenarios(owner, unavailable, owned, home);
    // Each transfer case starts with an empty target cache, even though it reuses the same kernel.
    await rm(join(home, "target-cache"), { recursive: true, force: true });
    await enter(owner, "grep");
    await enter(unavailable, "grep");
    await grepScenarios(owner, unavailable, assetSha, owned, home);
    await enter(owner, "hashedit");
    const run = async (code, options = {}) => {
      const result = await owner.execute("hashedit-regression", { code: `__import__("os").chdir(${JSON.stringify(join(tempRoot, "hashedit"))})\n${code}`, title: "Salted line reference editing", ...options });
      assert.equal(result.details.outcome, "ok", text(result));
      return result;
    };
    const result = await run(await readFile(new URL("../fixtures/kernel-hashedit.py", import.meta.url), "utf8"));
    assert.match(text(result), /HASHEDIT_BASIC_OK/);
    assert.match(text(result), /HASHEDIT_SCENARIOS_OK/);
    const perfLine = text(result).split("\n").find((line) => line.startsWith("HASHEDIT_PERF "));
    assert(perfLine, "real 10k-line edit measurements must be reported");
    const perf = JSON.parse(perfLine.slice("HASHEDIT_PERF ".length));
    assert.equal(perf.lines, 10_000);
    assert.equal(typeof perf.fast_edit_ms, "number");
    assert.equal(typeof perf.external_change_edit_ms, "number");
    console.log(perfLine);
    const restarted = await run(String.raw`
from pathlib import Path
import json, os
saved = json.loads(Path("hashedit-restart.json").read_text(encoding="utf-8"))
assert os.getpid() != saved["pid"], "reset:true must start a different Python process"
path = Path(saved["path"])
before = path.read_bytes()
operation = {"op": "replace", "start": saved["ref"], "end": saved["ref"], "text": "after-restart"}
try:
    edit(path, [operation])
except ValueError as error:
    assert hasattr(error, "context"), "restart refusal must return fresh context"
else:
    raise AssertionError("old ref accepted immediately after kernel restart")
assert path.read_bytes() == before
fresh = read(path)
assert fresh["path"] == str(path.resolve()) and fresh["total_lines"] == 1
assert fresh["lines"][0]["text"] == "before-restart"
assert fresh["lines"][0]["ref"] == saved["ref"], "reread must restore the same deterministic coordinate"
result = edit(path, [operation])
assert any(row["kind"] == "+" and row["text"] == "after-restart" for row in result["diff"]), result
assert path.read_bytes() == b"after-restart\n"
print("HASHEDIT_RESTART_OK")
`, { reset: true });
    assert.match(text(restarted), /HASHEDIT_RESTART_OK/);
    console.log("PASS real owned Jupyter salted refs: streaming pagination/caps, chained diffs and coordinate translation, atomic batches, stale/unread refusal, external alignment, encoding/EOF/metadata, aliases/write invalidation, actual restart and 10k-line measurements");
  }, { allowHidden: true });
} finally { await rm(home, { recursive: true, force: true }); }
