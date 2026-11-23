import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { DEFAULT_CODEMODE_OPTIONS } from "../../../src/config/codemode/codemode-options.ts";
import { answerBinRequest } from "../../../src/codemode/binary-delivery/answer-bin-request.ts";
import { binPrompt } from "../../../src/codemode/binary-delivery/describe-binaries.ts";
import { createBridgeDeployment } from "./create-bridge-deployment.mjs";

const text = (result) => result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");

export async function verifyBridgeBinaries({ run, binDir, cacheDir, target, artifactStore, onCleanup }) {
  const deployment = await createBridgeDeployment(target, binDir, cacheDir);
  onCleanup(() => deployment.close());
  let result;
    const arch = { x64: "x86_64", arm64: "aarch64" }[process.arch];
    const [alias, otherAlias] = arch === "x86_64" ? ["amd64", "arm64"] : ["arm64", "amd64"];
    result = await run("try:\n    tool_bin('fakebin')\n    raise AssertionError('missing asset resolved')\nexcept RuntimeError as error:\n    print(error)");
    assert.equal(result.isError, false, text(result));
    assert.equal(binPrompt(binDir), undefined, "no assets: the prompt must not advertise tool_bin");
    const script = `#!/bin/sh\n# ${"padding ".repeat(30)}\necho "fakebin:$1"\n`;
    const sha = createHash("sha256").update(script).digest("hex");
    const changedScript = script.replace('echo "fakebin:', 'echo "updated:');
    const changedSha = createHash("sha256").update(changedScript).digest("hex");
    await artifactStore.upload("fakebin", "one", arch, Readable.from([Buffer.from(script)]));
    await artifactStore.upload("fakebin", "two", arch, Readable.from([Buffer.from(changedScript)]));
    assert.match(binPrompt(binDir), /fakebin/);
    assert.doesNotMatch(binPrompt(binDir), /disk_usage/, "a wrapper is listed only when its CLI is present");
    const request = { name: "fakebin", system: "Linux", machine: alias };
    assert.deepEqual(await answerBinRequest(binDir, request), { sha256: sha, size: Buffer.byteLength(script) });
    // Metadata must use the manifest digest, not silently bless changed store bytes with a new digest.
    const blob = join(binDir, "store", sha);
    await writeFile(blob, changedScript);
    try {
      assert.deepEqual(await answerBinRequest(binDir, request), { sha256: sha, size: Buffer.byteLength(changedScript) }, "manifest SHA remains authoritative when blob bytes differ");
    } finally { await writeFile(blob, script); }
    const pinned = await deployment.read("fakebin");
    await artifactStore.setCurrent("fakebin", "two");
    assert.deepEqual(await answerBinRequest(binDir, request), { sha256: changedSha, size: Buffer.byteLength(changedScript) });
    const transferred = await deployment.transfer(pinned);
    assert(transferred.sent && transferred.acknowledgements.length > 1, "real multi-chunk deployment remains pinned to the captured SHA after switching current");
    result = await run(`from pathlib import Path\nassert Path(${JSON.stringify(pinned.path)}).read_bytes() == ${JSON.stringify(script)}.encode()`);
    assert.equal(result.isError, false, text(result));
    await artifactStore.setCurrent("fakebin", "one");
    assert.deepEqual(await answerBinRequest(binDir, request), { sha256: sha, size: Buffer.byteLength(script) });
    const cached = join(cacheDir, "bin", sha, "fakebin");
    result = await run(`import os, subprocess, shutil, base64, sys, json
run_bin = lambda path, arg: subprocess.run([path, arg], capture_output=True, text=True).stdout
first = tool_bin('fakebin')
assert first == ${JSON.stringify(cached)}, first
assert os.stat(first).st_mode & 0o777 == 0o555
assert run_bin(first, 'one') == 'fakebin:one\\n'
inode = os.stat(first).st_ino
module = sys.modules['_prk_codemode']
original_sha256 = module._bin_sha256
hash_reads = []
def counted_sha256(path):
    hash_reads.append(path)
    return original_sha256(path)
module._bin_sha256 = counted_sha256
assert tool_bin('fakebin') == first and os.stat(first).st_ino == inode, 'cache hit must not re-transfer'
assert hash_reads == [], 'unchanged target cache must not be hashed again'
# A stat change with identical bytes needs one verification, not a download.
before = os.stat(first)
os.utime(first, ns=(before.st_atime_ns, before.st_mtime_ns + 1000000000))
assert tool_bin('fakebin') == first and os.stat(first).st_ino == inode
assert hash_reads == [first], 'changed stat must be verified once'
assert tool_bin('fakebin') == first and hash_reads == [first]
os.chmod(first, 0o755)  # Deliberately corrupt this owned immutable deployment artifact.
with open(first, 'w') as corrupt:
    corrupt.write('corrupt')
try:
    tool_bin('fakebin')
    raise AssertionError('corrupt cache was silently repaired')
except RuntimeError as error:
    assert 'ENVIRONMENT_REQUIRED' in str(error), error
assert hash_reads == [first, first], 'corrupt cache must be rehashed before refusing execution'
module._bin_sha256 = original_sha256
print('CORRUPT_CACHE_REJECTED')`);
    assert.equal(result.isError, false, text(result));
    await deployment.transfer(await deployment.read("fakebin"));
    result = await run(`assert tool_bin('fakebin') == first and run_bin(first, 'two') == 'fakebin:two\\n'
shutil.rmtree(os.path.dirname(first))
try:
    tool_bin('fakebin')
    raise AssertionError('missing cache was implicitly downloaded')
except RuntimeError as error:
    assert 'ENVIRONMENT_REQUIRED' in str(error), error`);
    assert.equal(result.isError, false, text(result));
    const corruptPath = join(binDir, "corrupt-transfer");
    await writeFile(corruptPath, Buffer.alloc(50, 88));
    await assert.rejects(deployment.transfer(await deployment.read("fakebin"), { path: corruptPath, size: 50, gzip: false }), /SHA-256/);
    result = await run(`assert os.listdir(os.path.dirname(first)) == [], 'failed transfer leaves nothing behind'
original_cache = module._config['targetCacheRoot']
module._config['targetCacheRoot'] = '/proc/prk-unwritable'
try:
    tool_bin('fakebin')
    raise AssertionError('unwritable cache accepted')
except RuntimeError as error:
    assert 'ENVIRONMENT_REQUIRED' in str(error), error
finally:
    module._config['targetCacheRoot'] = original_cache
raw = lambda machine, system='Linux': module._bin_request({'name': 'fakebin', 'system': system, 'machine': machine})
assert raw(${JSON.stringify(alias)}) == {'sha256': ${JSON.stringify(sha)}, 'size': ${Buffer.byteLength(script)}}
for machine, system in [(${JSON.stringify(otherAlias)}, 'Linux'), ('x86_64', 'Darwin'), ('riscv64', 'Linux')]:
    try:
        raw(machine, system)
        raise AssertionError('unsupported platform accepted')
    except RuntimeError:
        pass
try:
    module._bin_request({'name': 'fakebin', 'system': 'Linux', 'machine': ${JSON.stringify(alias)}, 'offset': 0, 'length': 7})
    raise AssertionError('chunk request without metadata sha256 accepted')
except RuntimeError:
    pass
print('TOOL_BIN_OK')`);
    assert.equal(result.isError, false, text(result));
    assert.match(text(result), /TOOL_BIN_OK/);

    await artifactStore.setCurrent("fakebin", "two");
    result = await run("try:\n    tool_bin('fakebin')\n    raise AssertionError('new current used an old cached version')\nexcept RuntimeError as error:\n    assert 'ENVIRONMENT_REQUIRED' in str(error), error");
    assert.equal(result.isError, false, text(result));
    await deployment.transfer(await deployment.read("fakebin"));
    result = await run(`changed = tool_bin('fakebin')
assert changed == ${JSON.stringify(join(cacheDir, "bin", changedSha, "fakebin"))} and changed != first, changed
assert run_bin(changed, 'three') == 'updated:three\\n'
print('ASSET_REPLACED_OK')`);
    assert.equal(result.isError, false, text(result));
    assert.match(text(result), /ASSET_REPLACED_OK/);
    await artifactStore.setCurrent("fakebin", "one");
    await deployment.transfer(await deployment.read("fakebin"));
    result = await run(`rolled_back = tool_bin('fakebin')
assert rolled_back == first and rolled_back != changed, rolled_back
assert run_bin(rolled_back, 'four') == 'fakebin:four\\n'
print('ASSET_ROLLBACK_OK')`);
    assert.equal(result.isError, false, text(result));
    assert.match(text(result), /ASSET_ROLLBACK_OK/);

    // disk_usage: the real dust when PI_TEST_DUST names one, otherwise a stand-in printing dust's JSON shape.
    const dust = process.env.PI_TEST_DUST ? createReadStream(process.env.PI_TEST_DUST) : Readable.from([Buffer.from(`#!/bin/sh\nfor last; do :; done\n[ -e "$last" ] || { echo "No such file or directory: $last" >&2; exit 1; }\nprintf '{"size":"13000B","name":"%s","children":[{"size":"10000B","name":"%s/a.bin","children":[]}]}' "$last" "$last"\n`)]);
    await artifactStore.upload("dust", "one", arch, dust);
    await deployment.transfer(await deployment.read("dust"));
    assert.match(binPrompt(binDir), /disk_usage/);
    const usageRoot = join(target.root, "usage");
    result = await run(`from pathlib import Path\nPath(${JSON.stringify(join(usageRoot, "sub"))}).mkdir(parents=True)\nPath(${JSON.stringify(join(usageRoot, "a.bin"))}).write_bytes(bytes([1])*10000)\nPath(${JSON.stringify(join(usageRoot, "sub", "b.bin"))}).write_bytes(bytes([1])*3000)`);
    assert.equal(result.isError, false, text(result));
    result = await run(`module._config['codemode']['binChunkBytes'] = ${DEFAULT_CODEMODE_OPTIONS.binChunkBytes}
usage = disk_usage(${JSON.stringify(usageRoot)}, depth=1, apparent=True)
print(usage)
assert usage['path'] == ${JSON.stringify(usageRoot)} and usage['bytes'] >= 13000, usage
assert usage['children'][0] == {'path': ${JSON.stringify(join(usageRoot, "a.bin"))}, 'bytes': 10000, 'children': []}, usage
try:
    disk_usage(${JSON.stringify(join(usageRoot, "missing"))})
    raise AssertionError('missing path accepted')
except RuntimeError as error:
    assert 'missing' in str(error), error
print('DISK_USAGE_OK')`);
    assert.equal(result.isError, false, text(result));
    assert.match(text(result), /DISK_USAGE_OK/);
    console.log(text(result));
}
