import { createTargetChannels } from "../../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../../src/target-channel/process-transport/open.ts";
import { readArtifact } from "../../../src/remote-extensions/deployment/read-artifact.ts";
import { prepareTransfer } from "../../../src/remote-extensions/deployment/prepare-transfer.ts";
import { transferArtifact } from "../../../src/remote-extensions/deployment/transfer-artifact.ts";

export async function createBridgeDeployment(target, storeDir, targetCacheRoot) {
  const environment = await target.acquire();
  const channels = createTargetChannels({ options: { startTimeoutMs: 10000 }, open: async (_, signal, limits) => ({
    transport: await openProcessTransport(await target.acquire(), target.python, target.root, signal, 10000, limits, { PRK_TARGET_CACHE_ROOT: targetCacheRoot }), command: "",
  }) });
  const lease = channels.acquire("owned");
  const platform = await lease.request("remoteExtensions", "platform");
  const context = { lease, storeDir, binChunkBytes: 16, target: { system: platform.system, machine: platform.machine } };
  return {
    read: (name) => readArtifact(context, name, "tool"),
    transfer: async (asset, transfer) => {
      const acknowledgements = [];
      const sent = await transferArtifact(context, asset, transfer ?? await prepareTransfer(storeDir, asset), environment, (bytes) => acknowledgements.push(bytes));
      return { sent, acknowledgements };
    },
    close: async () => { try { await lease.release(); } finally { await environment.release(); } },
  };
}
