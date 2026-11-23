import type { HostContext } from "../host-state.ts";
import { createTargetChannels } from "../../../target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../../target-channel/process-transport/open.ts";
import { createTargetEnvironments } from "../../../target-environment/connection/assemble-environments.ts";
import { requireConfigured } from "../../../config/execution-target/require-configured.ts";
import { resolveCacheRoot } from "../../../target-environment/python/resolve-cache-root.ts";
import { managedPythonPaths } from "../../../target-environment/python/managed-paths.ts";

export function openTargetChannels(ctx: HostContext): void {
  ctx.host.environments = ctx.host.dependencies.runtimeDependencies?.targetEnvironments ?? createTargetEnvironments({
    targetCacheRoot: ctx.host.config.targetCacheRoot,
    resolve(id) {
      const target = ctx.instances.targets.find((candidate) => candidate.id === id);
      if (!target) throw new Error("Target is no longer configured.");
      requireConfigured(target);
      return target.local ? { local: true } : { local: false, command: target.sshCommand! };
    },
  });
  ctx.host.channels = ctx.host.dependencies.runtimeDependencies?.targetChannels ?? createTargetChannels({
    options: { startTimeoutMs: ctx.host.config.targetConnection.startTimeoutMs, processWindow: ctx.host.config.processWindow },
    async open(machine, signal, limits) {
      const target = ctx.instances.targets.find((candidate) => candidate.id === machine);
      if (!target) throw new Error("Target is no longer configured.");
      requireConfigured(target);
      const environment = await ctx.host.environments.acquire(machine);
      const root = resolveCacheRoot(environment.info.home, ctx.host.config.targetCacheRoot);
      const python = target.python ?? managedPythonPaths(root, machine).python;
      return { transport: await openProcessTransport(environment, python, target.kernel.cwd,
        signal, ctx.host.config.targetConnection.startTimeoutMs, limits, { PRK_TARGET_CACHE_ROOT: root }), command: "" };
    },
    log: (message) => console.error(`[${new Date().toISOString()}] Gateway ${message}`),
  });
}
