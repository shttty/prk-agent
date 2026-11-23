import { DEFAULT_CODEMODE_OPTIONS } from "../../config/codemode/codemode-options.ts";
import { install } from "../../remote-extensions/deployment/install-artifact.ts";
import type { KernelConfiguration } from "../kernel-types.ts";
import { waitBeforeAbort } from "./wait-before-abort.ts";

export async function resolveBun({ acquire, storeDir }: NonNullable<KernelConfiguration["bun"]>, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  const lease = acquire();
  try {
    signal.throwIfAborted();
    const { system, machine } = await waitBeforeAbort(lease.request("remoteExtensions", "platform"), signal);
    if (typeof system !== "string" || typeof machine !== "string") throw new Error("Invalid Bun target platform.");
    signal.throwIfAborted();
    // install only checks the existing target cache for the manifest's current immutable hash.
    return await waitBeforeAbort(install({ lease, storeDir, target: { system, machine }, binChunkBytes: DEFAULT_CODEMODE_OPTIONS.binChunkBytes }, "bun", "tool"), signal);
  } finally {
    await waitBeforeAbort(lease.release(), signal);
  }
}
