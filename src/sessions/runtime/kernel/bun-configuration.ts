import type { ExecutionTarget } from "../../../config/execution-target/target-types.ts";
import type { KernelConfiguration } from "../../../kernel/kernel-types.ts";
import type { TargetChannels } from "../../../target-channel/channels/channel-types.ts";
import type { TargetEnvironmentLease } from "../../../target-environment/connection/connection-types.ts";
import { resolveCacheRoot } from "../../../target-environment/python/resolve-cache-root.ts";

export function bunConfiguration(target: ExecutionTarget, storeDir: string, channels: TargetChannels, home: string, cacheRoot?: string): NonNullable<KernelConfiguration["bun"]> {
  return { storeDir, acquire: () => channels.acquire(target.id), ...(target.bunPackages && {
    packages: { ...target.bunPackages, cacheRoot: resolveCacheRoot(home, cacheRoot) },
  }) };
}

export async function checkRuntimeExecutable(environment: TargetEnvironmentLease, cwd: string, executable: string, signal: AbortSignal) {
  const reply = await environment.connection.request("exec", { cwd, argv: [executable, "--version"], timeoutMs: 5000 }, { signal });
  if (reply.json.exitCode !== 0) throw new Error("The selected runtime executable did not pass its version check.");
}
