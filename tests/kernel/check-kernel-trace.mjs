import assert from "node:assert/strict";
import { join } from "node:path";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { DEFAULT_TRACE_OPTIONS } from "../../src/config/trace/trace-options.ts";
import { parseTraceOptions } from "../../src/config/trace/parse-trace-options.ts";
import { kernelPrelude } from "../../src/codemode/kernel-prelude/build-prelude.ts";
import { createTarget } from "./fixtures/create-target.mjs";
import { createSession } from "./fixtures/create-session.mjs";

const target = await createTarget(process.argv[2] ?? "local");
let fixture;
const text = (result) => result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
try {
  assert.deepEqual(parsePrkConfig({}).trace, DEFAULT_TRACE_OPTIONS);
  assert.deepEqual(parsePrkConfig({ trace: { maxRecords: 2 } }).trace, { ...DEFAULT_TRACE_OPTIONS, maxRecords: 2 });
  for (const value of [null, [], 1, { extra: 1 }, { maxRecords: 0 }, { argumentChars: -1 }, { maxArguments: 1.5 }, { maxArguments: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.throws(() => parsePrkConfig({ trace: value }), /trace/);
  }
    const options = parseTraceOptions(undefined);
    fixture = await createSession(target, { hooks: { prelude: () => kernelPrelude({ trace: options }) } });
    const run = async (code) => (await fixture.run(code)).result;
    const tempRoot = target.root;
    let result = await run([
      "import os, sys, sysconfig, json, subprocess, dbm.dumb, xml.dom.minidom, plistlib",
      "from pathlib import Path",
      "prefixes = [os.path.realpath(sys.prefix), os.path.realpath(sys.base_prefix)]",
      "stdlib_source = os.path.join(sysconfig.get_paths()['stdlib'], 'os.py')",
      "os.symlink(stdlib_source, 'runtime-link.py')",
      "with open(stdlib_source) as stream: assert stream.read(1)",
      "with open('runtime-link.py') as stream: assert stream.read(1)",
      "read_fd, write_fd = os.pipe()",
      "os.close(write_fd)",
      "with os.fdopen(read_fd) as stream: assert stream.read() == ''",
      "with open('raw.txt', 'w') as stream: stream.write('raw data')",
      "with open('raw.txt') as stream: assert stream.read() == 'raw data'",
      "os.rename('raw.txt', 'renamed.txt')",
      "os.unlink('renamed.txt')",
      "Path('helper.txt').write_text('path helper data')",
      "assert Path('helper.txt').read_text() == 'path helper data'",
      "assert subprocess.run(['sh', '-c', 'printf subprocess > subprocess-only.txt'], capture_output=True).returncode == 0",
      "assert os.system('printf system > system-only.txt') == 0",
      "print(json.dumps(prefixes))",
    ].join("\n"));
    assert.equal(result.isError, false, text(result));
    const traces = result.details.traces;
    const has = (event, path, operation) => traces.some((trace) => trace.event === event && trace.operation === operation && trace.args[0]?.includes(path));
    assert(has("open", "raw.txt", "write"));
    assert(has("open", "raw.txt", "read"), "raw reads bypassing helpers must be retained");
    assert(has("os.rename", "raw.txt", "rename"));
    assert(has("os.remove", "renamed.txt", "delete"));
    assert(has("open", "helper.txt", "write"));
    assert(has("open", "helper.txt", "read"));
    assert(traces.some((trace) => trace.event === "subprocess.Popen" && trace.operation === "command"));
    assert(traces.some((trace) => trace.event === "os.system" && trace.operation === "command"));
    const prefixes = JSON.parse(text(result).trim().split("\n")[0]);
    const opens = traces.filter((trace) => trace.event === "open");
    assert(opens.every((trace) => !/^\d+$/.test(trace.args[0])), "integer-fd pipe opens must be filtered");
    assert(opens.every((trace) => !prefixes.some((prefix) => trace.args[0].includes(prefix))), "interpreter and stdlib noise must be filtered");
    assert(opens.every((trace) => !trace.args[0].includes("runtime-link.py")), "prefix filtering must use real paths");
    assert(opens.every((trace) => !/subprocess-only|system-only/.test(trace.args[0])), "subprocess interior writes must not be claimed");
    assert.equal(await target.observe(`cat '${join(tempRoot, "subprocess-only.txt")}'`), "subprocess");
    assert.equal(await target.observe(`cat '${join(tempRoot, "system-only.txt")}'`), "system");
    assert(traces.every((trace) => trace.time && trace.args.length <= options.maxArguments && trace.args.every((arg) => arg.length <= options.argumentChars)));
    assert(!text(result).includes("application/x-prk-trace+json"), "private trace metadata must not be rendered");

    result = await run("open('missing-attempt.txt')");
    assert.equal(result.isError, true);
    assert(result.details.traces.some((trace) => trace.operation === "read" && trace.args[0]?.includes("missing-attempt.txt")), "failed operation attempts keep trace details");

    const limited = parseTraceOptions({ maxRecords: 2, argumentChars: 7, maxArguments: 1 });
    await run(await kernelPrelude({ trace: limited }));
    result = await run("open('one.txt', 'w').close()\nopen('two.txt', 'w').close()\nopen('three.txt', 'w').close()");
    assert.equal(result.isError, false, text(result));
    assert.equal(result.details.traces.length, 2, "per-cell record cap must apply");
    assert.deepEqual(result.details.traces.map((trace) => trace.args), [["'one.tx"], ["'two.tx"]], "argument count/character caps and replacement must not duplicate records");
    result = await run("open('next.txt', 'w').close()");
    assert.deepEqual(result.details.traces.map((trace) => trace.args), [["'next.t"]], "record cap resets on the next cell");

    // SDK persistence/private mixed-MIME output is already covered by check-kernel-bridge.mjs.
    console.log("PASS owned stdlib REPL + real SDK operation trace: raw/path-helper reads+writes, rename/delete, command launches, realpath/fd filtering, failed attempts, configurable caps and replacement teardown");
} finally { await fixture?.close(); await target.close(); }
