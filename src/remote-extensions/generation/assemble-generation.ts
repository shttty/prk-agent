import { randomUUID } from "node:crypto";
import type { GenerationContext, RemoteExtensionOptions } from "./generation-types.ts";
import { observeChannel } from "./connection/observe-channel.ts";
import { start } from "./lifecycle/start.ts";
import { close } from "./lifecycle/close.ts";
import { register } from "./callbacks/register.ts";

export function assembleGeneration(options: RemoteExtensionOptions): GenerationContext {
  const ctx: GenerationContext = {
    generation: randomUUID(), lease: options.channels.acquire(options.machine),
    pending: new Map(), abortAcks: new Map(), reverse: new Map(), serial: 0, revision: 0,
    live: false, unsubscribers: [], options,
    start: () => ctx.startPromise ??= start(ctx), register: (pi, registration) => register(ctx, pi, registration),
    close: (reason) => close(ctx, reason),
  };
  observeChannel(ctx);
  return ctx;
}
