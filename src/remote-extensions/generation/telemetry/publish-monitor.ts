import type { RemoteHostMonitor } from "../../../monitor/telemetry/telemetry-types.ts";
import type { GenerationContext } from "../generation-types.ts";

export function publishMonitor(ctx: GenerationContext, state: RemoteHostMonitor["state"], error?: Error): void {
    ctx.options.onMonitor?.({ state, generation: ctx.generation,
      ...(ctx.registration ? { pid: ctx.registration.pid } : {}),
      ...(ctx.scoped !== undefined ? { scoped: ctx.scoped } : {}),
      ...(ctx.memory ? { memory: ctx.memory, sampledAt: ctx.memoryAt } : {}),
      ...(error ? { error: error.message } : {}),
    });
}
