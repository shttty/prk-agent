import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { RemoteExecutionEnv } from "@earendil-works/pi-env";
import { createTransferContext } from "../../src/remote-extensions/deployment/create-transfer-context.ts";
import { prepareTransfer } from "../../src/remote-extensions/deployment/prepare-transfer.ts";
import { writeTransferredArtifact } from "../../src/remote-extensions/deployment/write-transferred-artifact.ts";
import { createOwnedEnvironment } from "../fixtures/target-environment/create-owned-environment.mjs";

const fixture = await createOwnedEnvironment({ prefix: "uvenv-transfer-no-python-" });
try {
  const environment = await fixture.acquire("local");
  const options = { connection: environment.connection, id: environment.generation, cwd: fixture.root };
  const setup = new RemoteExecutionEnv(options);
  const context = createTransferContext(environment.signal);
  const tools = join(fixture.root, "shell-tools");
  const prepared = await setup.exec(["/bin/sh", "-c", `
mkdir -p "$1" "$2"
for tool in gzip sha256sum chmod mv rm; do ln -s "$(command -v "$tool")" "$1/$tool"; done
`, "prk-transfer-tools", tools, join(fixture.root, "blobs")], {}, context);
  assert(prepared.ok && prepared.value.exitCode === 0);
  const remote = new RemoteExecutionEnv({ ...options, shellEnv: { PATH: tools } });
  const noPython = await remote.exec(["/bin/sh", "-c", "! command -v python && ! command -v python3"], {}, context);
  assert(noPython.ok && noPython.value.exitCode === 0, "the real installer has no target Python on PATH");
  const storeDir = join(fixture.root, "assets");
  await mkdir(join(storeDir, "store"), { recursive: true });

  for (const [name, content, executable, compressed] of [
    ["tool", Buffer.from(`#!/bin/sh\n# ${"transport padding ".repeat(100)}\nprintf 'ready\\n'\n`), true, true],
    ["python.tar.gz", gzipSync(Buffer.from("already-compressed Python archive bytes\n")), false, false],
  ]) {
    const sha256 = createHash("sha256").update(content).digest("hex");
    await writeFile(join(storeDir, "store", sha256), content);
    const transfer = await prepareTransfer(storeDir, { sha256, size: content.length });
    assert.equal(transfer.gzip, compressed, "precompressed files are transferred as raw bytes");
    const staging = { uploadPath: join(fixture.root, `${name}.upload`), blob: join(fixture.root, "blobs", sha256) };
    const begun = await setup.exec(["/bin/sh", "-c", ': > "$1"; : > "$1.install"', "prk-transfer-stage", staging.uploadPath], {}, context);
    assert(begun.ok && begun.value.exitCode === 0);
    const acknowledgements = [];
    await writeTransferredArtifact({ remote, signal: environment.signal, binChunkBytes: 17 }, { name, sha256, executable }, transfer, staging, (bytes) => acknowledgements.push(bytes));
    assert(acknowledgements.length > 1, "the real pi-env writer acknowledges multiple chunks");
    assert.equal(acknowledgements.reduce((sum, bytes) => sum + bytes, 0), transfer.size, "progress counts only transport bytes acknowledged by pi-env");
    assert.deepEqual(await readFile(staging.blob), content, "the original bytes, including a raw gzip archive, are preserved");
    assert.equal((await stat(staging.blob)).mode & 0o777, executable ? 0o555 : 0o444);
    assert(!existsSync(staging.uploadPath) && !existsSync(staging.uploadPath + ".install"), "successful publication leaves no owned staging");
  }
  console.log("PASS shell artifact transfer without target Python: gzip, raw archive, ACK byte progress, and staging cleanup");
} finally {
  await fixture.close();
}
