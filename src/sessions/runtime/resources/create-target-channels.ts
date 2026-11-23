import { createTargetChannels } from "../../../target-channel/channels/assemble-channels.ts";
import type { TargetChannels } from "../../../target-channel/channels/channel-types.ts";
import { openProcessTransport } from "../../../target-channel/process-transport/open.ts";
import { DEFAULT_TARGET_CONNECTION_OPTIONS } from "../../../config/target-connection/target-connection-options.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import { log } from "./log.ts";
import { DEFAULT_TARGET_CACHE_ROOT } from "../../../config/target-cache/target-cache-options.ts";

export function createRuntimeChannels(ctx: RuntimeContext): TargetChannels {
  return createTargetChannels({
    options: { startTimeoutMs: DEFAULT_TARGET_CONNECTION_OPTIONS.startTimeoutMs, processWindow: ctx.dependencies.processWindow },
    open: async (_machine, signal, limits) => ({ transport: await openProcessTransport(await ctx.environments.acquire(ctx.target.id),
      ctx.pythonRuntime.basePython, ctx.cwd, signal, DEFAULT_TARGET_CONNECTION_OPTIONS.startTimeoutMs, limits,
      { PRK_TARGET_CACHE_ROOT: ctx.dependencies.targetCacheRoot ?? DEFAULT_TARGET_CACHE_ROOT }), command: "" }),
    log,
  });
}
