// Full-only file-tool groups share an owned target and execute through their owning SDK sessions.
import assert from "node:assert/strict";
import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createFileKernel } from "./file-kernel.mjs";
import { kernelPrelude } from "../../src/codemode/kernel-prelude/build-prelude.ts";
const text = (result) => result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");

async function assertMissingRg(owner, code, home) {
  const absent = async () => {
    for (const path of [join(home, "missing-assets"), join(home, "missing-target-cache")]) {
      await assert.rejects(stat(path), { code: "ENOENT" });
    }
  };
  await absent();
  const direct = await owner.execute("rg-unavailable", { code: "tool_bin('rg')", title: "Missing rg artifact" });
  const failure = await owner.execute("search-unavailable", { code, title: "Unavailable rg must fail" });
  for (const result of [direct, failure]) {
    assert.equal(result.isError, true, text(result));
    assert.equal(result.details.outcome, "error", text(result));
  }
  const reason = text(direct).split("\n", 1)[0];
  assert.match(reason, /^RuntimeError:.*\brg\b/i);
  assert.equal(text(failure).split("\n", 1)[0], reason);
  await absent();
}

export async function filetoolsContract({ runtime, owned, tempRoot, onCleanup, home }) {
    assert.equal(owned, true);
    const options = {
      codeMode: true,
      prelude: () => kernelPrelude({ moduleHome: home, kernelTools: { files: { max_edit_bytes: 64 } } }),
    };
    const first = await createFileKernel({ ...runtime, cwd: tempRoot }, options, home, onCleanup);
    const second = await createFileKernel({ ...runtime, cwd: tempRoot }, options, home, onCleanup);
    const run = async (owner, code, title = 'File tools contract') => {
      const result = await owner.execute('filetools-contract', { code, title });
      assert.equal(result.details.outcome, 'ok', text(result));
      return text(result);
    };
    const output = await run(first, await readFile(new URL('../fixtures/kernel-filetools-contract.py', import.meta.url), 'utf8'));
    assert.match(output, /FILETOOLS_CONTRACT_OK/);
    assert.match(output, /FILETOOLS_EDIT_LIMIT_OK/);
    assert.match(output, /FILETOOLS_EDITORS_LOCKS_OK/);
    const memoryLine = output.split('\n').find((line) => line.startsWith('FILETOOLS_MEMORY '));
    assert(memoryLine, 'real two-million-row memory measurements must be reported');
    const memory = JSON.parse(memoryLine.slice('FILETOOLS_MEMORY '.length));
    assert.equal(memory.lines, 2_000_000);
    assert.equal(memory.bound_bytes, 32 * 1024 * 1024);
    for (const key of ['file_bytes', 'rss_before_bytes', 'rss_after_bytes', 'rss_delta_bytes', 'peak_before_bytes', 'peak_after_bytes', 'peak_delta_bytes']) {
      assert.equal(typeof memory[key], 'number', key);
      assert(Number.isFinite(memory[key]), key);
    }
    assert(memory.rss_delta_bytes <= memory.bound_bytes, memoryLine);
    assert(memory.peak_delta_bytes <= memory.bound_bytes, memoryLine);
    console.log(output);

    // Distinct real kernels share native file semantics, not a removed flock guarantee.
    for (const sameLine of [false, true]) {
      const name = sameLine ? 'same-line' : 'different-lines';
      const path = join(tempRoot, `ordered-${name}.txt`);
      await writeFile(path, 'left\nright\n');
      const prepared = await Promise.all([first, second].map((owner, index) => run(owner, `
from pathlib import Path
import os
race_path = Path(${JSON.stringify(path)})
race_view = read(race_path)
race_ref = race_view["lines"][${sameLine ? 0 : index}]["ref"]
assert [row["text"] for row in race_view["lines"]] == ["left", "right"]
print("CONCURRENT_PID", os.getpid())
`, `Prepare ${name} ${index}`)));
      const pids = prepared.map((value) => Number(value.match(/CONCURRENT_PID (\d+)/)?.[1]));
      assert(pids.every((pid) => Number.isInteger(pid) && pid > 0));
      assert.notEqual(pids[0], pids[1], 'ownership must use two real kernel processes');
      await run(first, `result = edit(race_path, [{"op":"replace","start":race_ref,"end":race_ref,"text":"FIRST"}])\nassert any(row["kind"] == "+" and row["text"] == "FIRST" for row in result["diff"]), result`);
      await run(second, sameLine ? `
try:
    edit(race_path, [{"op":"replace","start":race_ref,"end":race_ref,"text":"SECOND"}])
except ValueError as error:
    assert error.context["path"] == str(race_path.resolve()), error.context
else:
    raise AssertionError("stale same-line reference accepted")
` : `result = edit(race_path, [{"op":"replace","start":race_ref,"end":race_ref,"text":"SECOND"}])\nassert any(row["kind"] == "+" and row["text"] == "SECOND" for row in result["diff"]), result`);
      assert.equal(await readFile(path, 'utf8'), sameLine ? 'FIRST\nright\n' : 'FIRST\nSECOND\n');
      console.log('FILETOOLS_ORDERED', name, JSON.stringify({ pids }));
    }
    console.log('PASS real owned Jupyter/SDK/target-channel filetools: salted refs, ambiguous alignment/fresh retry, streaming 2m-row RSS bounds, edit limit override, editor locks, distinct-kernel ordered edits/stale refusal; no flock contract');
}

export async function bashScenarios(shared) {
  const owner = shared;
    const updates = [];
    const run = async (code) => {
      const result = await owner.execute("bash-regression", { code, title: "Bash semantics" }, undefined, (update) => updates.push({ at: Date.now(), text: text(update) }));
      assert.equal(result.details.outcome, "ok", text(result));
      return result;
    };
    const result = await run(String.raw`
import os, signal, time, json
from pathlib import Path
r = bash('read x; echo got=$x', timeout=2)
assert set(r) == {'exit_code', 'stdout', 'stderr', 'duration_ms', 'timed_out', 'truncated'}, r
assert r['truncated'] is False, r
assert r['exit_code'] == 0 and r['stdout'] == 'got=\n' and not r['timed_out'], r
assert r['duration_ms'] < 1500, r
r = bash('sleep 30 & echo $! > detached.pid; echo hi')
try:
    assert r['stdout'] == 'hi\n' and r['duration_ms'] < 1500, r
finally:
    os.kill(int(Path('detached.pid').read_text()), signal.SIGKILL)
r = bash('echo $$ > timeout.pid; exec sleep 30', timeout=1)
assert r['timed_out'] and r['exit_code'] != 0 and 900 <= r['duration_ms'] < 2500, r
try:
    os.kill(int(Path('timeout.pid').read_text()), 0)
    raise AssertionError('timed-out sleep still exists')
except ProcessLookupError:
    pass
r = bash("printf 'out\\rfinal\\n'; printf 'err\\n' >&2")
assert r['stdout'] == 'out\rfinal\n' and r['stderr'] == 'err\n', r
r = bash('printf "%s/%s/%s/%s" "$DEBIAN_FRONTEND" "$PIP_NO_INPUT" "$PYTHONUNBUFFERED" "$GIT_TERMINAL_PROMPT"')
assert r['stdout'] == 'noninteractive/1/1/0', r
r = bash("for n in 1 2 3; do printf 'LIVE_ONLY_%s\\r' $n; sleep 1; done")
assert r['stdout'] == 'LIVE_ONLY_1\rLIVE_ONLY_2\rLIVE_ONLY_3\r', r
print('BASH_SEMANTICS_OK')
`);
    assert.match(text(result), /BASH_SEMANTICS_OK/);
    assert.doesNotMatch(text(result), /LIVE_ONLY_|application\/x-prk-progress/);
    const live = updates.filter((update) => update.text.includes("LIVE_ONLY_"));
    assert(live.some((update) => update.text.includes("LIVE_ONLY_1") && !update.text.includes("LIVE_ONLY_3")), "onUpdate delivers output before the command finishes");
    assert(live.some((update) => update.text.includes("LIVE_ONLY_3")), "carriage-return chunks reach onUpdate");
    console.log("PASS real Jupyter bash: stdin EOF, detached pipe drain, process-group timeout, raw separate streams, noninteractive env and UI-only live progress");
}

export async function globScenarios(shared, missing, owned, home) {
  const owner = shared;
  const unavailable = missing;
    assert.equal(owned, true);
    const result = await owner.execute("glob-regression", {
      code: await readFile(new URL("../fixtures/kernel-glob.py", import.meta.url), "utf8"),
      title: "Target file glob with bounded results",
    });
    assert.equal(result.details.outcome, "ok", text(result));
    assert.match(text(result), /GLOB_SCENARIOS_OK/);
    console.log(text(result));
    await assertMissingRg(unavailable, "glob('**/*')", home);
    console.log("PASS real owned Jupyter glob: recursion/hidden/gitignore/sorting/limits/output budget/errors and real tool_bin transfer; no mock rg");
}

export async function grepScenarios(owner, unavailable, assetSha, owned, home) {
    assert.equal(owned, true);
    const result = await owner.execute("grep-regression", {
      code: `expected_rg_sha = ${JSON.stringify(assetSha)}\n` + await readFile(new URL("../fixtures/kernel-grep.py", import.meta.url), "utf8"),
      title: "Directory grep with editable refs",
    });
    assert.equal(result.details.outcome, "ok", text(result));
    assert.match(text(result), /GREP_SCENARIOS_OK/);
    console.log(text(result));
    await assertMissingRg(unavailable, "grep('needle')", home);
    const independent = await unavailable.execute("files-without-rg", {
      code: String.raw`
from pathlib import Path
path = Path("files-without-rg.txt")
assert write(path, "read and edit remain available\n")["written"] == len("read and edit remain available\n")
view = read(path)
ref = view["lines"][0]["ref"]
result = edit(path, [{"op": "replace", "start": ref, "end": ref, "text": "edited without rg"}])
assert path.read_bytes() == b"edited without rg\n"
assert any(row["kind"] == "+" and row["text"] == "edited without rg" for row in result["diff"])
print("FILES_WITHOUT_RG_OK")
`,
      title: "File tools without rg",
    });
    assert.equal(independent.details.outcome, "ok", text(independent));
    assert.match(text(independent), /FILES_WITHOUT_RG_OK/);
    console.log("PASS real owned Jupyter grep: directory/glob/options/ignore/binary/budgets/errors, match/context direct edit, unseen refusal, real tool_bin transfer and unavailable rg error");
}
