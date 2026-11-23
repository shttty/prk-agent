import assert from "node:assert/strict";
import { createWriteStream, existsSync, statSync, watch } from "node:fs";
import { readFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { gzipSync } from "node:zlib";
import { RemoteExecutionEnv } from "@earendil-works/pi-env";
import { createTransferContext } from "../../src/remote-extensions/deployment/create-transfer-context.ts";
import { createOwnedEnvironment } from "../fixtures/target-environment/create-owned-environment.mjs";
import { createTargetChannels } from "../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../src/target-channel/process-transport/open.ts";

assert(process.env.PI_TEST_PYTHON);
const source = await readFile(new URL("../../src/remote-extensions/deployment/install-transferred-artifact.sh", import.meta.url), "utf8");
let fixture, lease, environment, writer, observer;
try {
  fixture = await createOwnedEnvironment({ prefix: "uvenv-artifact-cleanup-" });
  const channels = createTargetChannels({ options: { startTimeoutMs: 10000 }, open: async (_, signal, limits) => ({
    transport: await openProcessTransport(await fixture.acquire("local"), process.env.PI_TEST_PYTHON, fixture.root, signal, 10000, limits), command: "",
  }) });
  lease = channels.acquire("local");
  environment = await fixture.acquire("local");
  const remote = new RemoteExecutionEnv({ connection: environment.connection, id: environment.generation, cwd: fixture.root });
  const context = createTransferContext(environment.signal);
  const begin = async (name, sha256, size) => lease.request("remoteExtensions", "assetBegin", { name, sha256, size, kind: "tool" });
  const invoke = (asset, hash, callContext = context) => remote.exec(["/bin/sh", "-c", source, "prk-install-artifact", asset.uploadPath, asset.blob, hash, "gzip", "yes"], {}, callContext);
  const absent = (asset) => {
    assert(!existsSync(asset.uploadPath), "owned upload is removed");
    assert(!existsSync(asset.uploadPath + ".install"), "owned decompression staging is removed");
    assert(!existsSync(asset.blob), "unverified data is never published");
  };
  if (!process.argv.includes("--cancel-only")) {
  const content = Buffer.from("verified artifact\n");
  const hash = createHash("sha256").update(content).digest("hex");
  const valid = await begin("valid", hash, content.length);
  assert(existsSync(valid.uploadPath + ".install"), "assetBegin owns decompression staging before exec starts");
  assert((await remote.writeFile(valid.uploadPath, gzipSync(content), context)).ok);
  const installed = await invoke(valid, hash);
  assert(installed.ok && installed.value.exitCode === 0);
  await lease.request("remoteExtensions", "assetFinish", { sha256: hash });
  assert.deepEqual(await readFile(valid.blob), content);
  assert(!existsSync(valid.uploadPath + ".install"));

  const wrongHash = "0".repeat(64);
  const invalid = await begin("invalid", wrongHash, content.length);
  assert((await remote.writeFile(invalid.uploadPath, gzipSync(content), context)).ok);
  const rejected = await invoke(invalid, wrongHash);
  assert(rejected.ok && rejected.value.exitCode !== 0, "decompressed checksum mismatch fails");
  await lease.request("remoteExtensions", "assetAbort", { sha256: wrongHash });
  absent(invalid);
  console.log("PASS checksum mismatch: no destination or owned staging remains");
  }

  const expanded = randomBytes(4 * 1024 * 1024);
  const compressed = gzipSync(expanded);
  const interruptedHash = createHash("sha256").update(expanded).digest("hex");
  const interrupted = await begin("interrupted", interruptedHash, expanded.length);
  const fifo = await remote.exec(["/bin/sh", "-c", 'rm -- "$1"; mkfifo -- "$1"', "prk-transfer-fifo", interrupted.uploadPath], {}, context);
  assert(fifo.ok && fifo.value.exitCode === 0);
  const cancel = new AbortController();
  const partial = Promise.withResolvers();
  const timer = setTimeout(() => partial.reject(new Error("The real installer did not write its owned staging file")), 10000);
  observer = watch(interrupted.uploadPath + ".install", () => {
    const bytes = statSync(interrupted.uploadPath + ".install").size;
    if (bytes > 0) partial.resolve(bytes);
  });
  const running = invoke(interrupted, interruptedHash, createTransferContext(AbortSignal.any([environment.signal, cancel.signal])));
  writer = createWriteStream(interrupted.uploadPath);
  writer.on("error", partial.reject);
  writer.write(compressed.subarray(0, Math.floor(compressed.length / 2)));
  let bytes;
  try { bytes = await partial.promise; } finally { clearTimeout(timer); observer.close(); observer = undefined; }
  assert(bytes > 0 && bytes < expanded.length, "cancel happens during actual partial decompression, not before startup");
  cancel.abort(new Error("Owned cancellation test"));
  const stopped = await running;
  assert.equal(stopped.ok, false, "the public exec observes cancellation");
  writer.destroy(); writer = undefined;
  await lease.request("remoteExtensions", "assetAbort", { sha256: interruptedHash });
  absent(interrupted);
  const late = await invoke(interrupted, interruptedHash);
  assert(late.ok && late.value.exitCode !== 0, "an exec admitted after cleanup cannot recreate the removed staging file");
  absent(interrupted);
  console.log(JSON.stringify({ cancelledDuringDecompression: true, expandedBytesWritten: bytes, expectedBytes: expanded.length, noPartialPublished: true, noStagingRemains: true, lateExecCannotRecreate: true }));
} finally {
  observer?.close(); writer?.destroy();
  await lease?.release(); await environment?.release(); await fixture?.close();
}
