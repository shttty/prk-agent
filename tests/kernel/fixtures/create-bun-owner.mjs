import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { ArtifactStore } from "../../../src/artifacts/store/assemble-store.ts";
import { createPythonTool } from "../../../src/kernel/assemble-kernel.ts";
import { createTargetChannels } from "../../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../../src/target-channel/process-transport/open.ts";
import { parseProcessWindowLimits } from "../../../src/target-environment/process-window/parse-limits.ts";
import { findFixtureExecutable } from "../../fixtures/native-tool-artifacts.mjs";
import { createOwnedEnvironment } from "../../fixtures/target-environment/create-owned-environment.mjs";
import { DEFAULT_CODEMODE_OPTIONS } from "../../../src/config/codemode/codemode-options.ts";
import { readArtifact } from "../../../src/remote-extensions/deployment/read-artifact.ts";
import { prepareTransfer } from "../../../src/remote-extensions/deployment/prepare-transfer.ts";
import { transferArtifact } from "../../../src/remote-extensions/deployment/transfer-artifact.ts";

export async function withBunOwner(run, hooks = {}) {
  const source = await findFixtureExecutable("bun", process.env.PI_TEST_BUN_BINARY);
  const python = process.env.PI_TEST_PYTHON ?? "/usr/bin/python3";
  const fixture = await createOwnedEnvironment({ prefix: "prk-bc-" });
  const cwd = fixture.root;
  const cacheRoot = join(cwd, "target-cache");
  const acquire = () => fixture.acquire("local");
  const store = new ArtifactStore(join(cwd, "prk", "assets"));
  const processWindow = parseProcessWindowLimits();
  const channels = createTargetChannels({ options: { startTimeoutMs: 10000, processWindow }, open: async (_, signal, limits) => ({
    command: "", transport: await openProcessTransport(await acquire(), python, cwd, signal, 10000, limits, { PRK_TARGET_CACHE_ROOT: cacheRoot }),
  }) });
  const bun = { storeDir: store.directory, acquire: () => channels.acquire("local") };
  const configuration = { target: "local", python, cwd, acquire, processWindow, memoryMax: "512M", memorySwapMax: "0", scoped: false, bun };
  const owner = createPythonTool(configuration, hooks);
  try {
    const version = execFileSync(source, ["--version"], { encoding: "utf8", timeout: 5000 }).trim();
    await store.upload("bun", version, "x86_64", createReadStream(source));
    const lease = bun.acquire();
    try {
      const target = await lease.request("remoteExtensions", "platform");
      const context = { lease, target, storeDir: store.directory, binChunkBytes: DEFAULT_CODEMODE_OPTIONS.binChunkBytes };
      const asset = await readArtifact(context, "bun", "tool");
      assert.equal(await transferArtifact(context, asset, await prepareTransfer(store.directory, asset), await acquire(), () => {}), true);
    } finally { await lease.release(); }
    await run(owner, configuration);
  } finally {
    try { await owner.close(); } finally { await fixture.close(); }
  }
}

export const text = (result) => result.content.filter(({ type }) => type === "text").map(({ text }) => text).join("\n");
