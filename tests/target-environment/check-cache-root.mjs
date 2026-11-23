import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTargetEnvironments } from "../../src/target-environment/connection/assemble-environments.ts";
import { quoteShell } from "../../src/target-environment/daemon/quote-shell.mjs";
import { createTargetChannels } from "../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../src/target-channel/process-transport/open.ts";

if (!process.env.PI_TEST_PYTHON) throw new Error("PI_TEST_PYTHON must name an absolute test Python interpreter");
const root = await mkdtemp(join(tmpdir(), "prk-cache-root-"));
const home = join(root, "target-home");
const cache = join(home, "owned-cache");
const events = [];
const environments = createTargetEnvironments({
  targetCacheRoot: "~/owned-cache",
  resolve: () => ({ local: false, command: `HOME=${quoteShell(home)} exec /bin/sh` }),
  onEvent: (_id, event) => events.push(event),
});
const channels = createTargetChannels({ options: { startTimeoutMs: 10000 }, open: async (_id, signal, limits) => ({
  transport: await openProcessTransport(await environments.acquire("owned"), process.env.PI_TEST_PYTHON, home, signal, 10000, limits,
    { PRK_TARGET_CACHE_ROOT: "~/owned-cache" }), command: "",
}) });
let lease;
try {
  await mkdir(home);
  lease = channels.acquire("owned");
  const toolHash = "1".repeat(64);
  const nodeHash = "2".repeat(64);
  const tarHash = "3".repeat(64);
  for (const [kind, sha256, path] of [
    ["tool", toolHash, join(cache, "bin", toolHash, "probe")],
    ["binary", nodeHash, join(cache, "remote-extensions", "binary", nodeHash)],
    ["tar", tarHash, join(cache, "remote-extensions", "bundle", tarHash)],
  ]) {
    const { cached, path: actualPath } = await lease.request("remoteExtensions", "assetCheck", { kind, sha256, size: 1, ...(kind === "tool" ? { name: "probe" } : {}) });
    assert.deepEqual({ cached, path: actualPath }, { cached: false, path });
  }
  const deployment = events.find((event) => event.kind === "deployment");
  assert(deployment?.daemon.startsWith(`${cache}/pi-env/1.6.0/`), JSON.stringify(events));
  assert.deepEqual(await readdir(home), ["owned-cache"], "the default cache is never created in the owned target HOME");
  console.log("PASS configured target cache root: target ~/ expansion, daemon, CLI, Node and extension bundle paths through real process env");
} finally {
  try { await lease?.release(); }
  finally { await rm(root, { recursive: true, force: true }); }
}
