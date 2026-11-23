import { stop } from "./stop.mjs";

export function assembleMemory(scope, publish) {
  /** @type {import("./memory-types.ts").MemoryContext} */
  const ctx = { scope, publish, baseline: undefined, stopped: false, timer: undefined, stop: undefined };
  ctx.stop = stop.bind(undefined, ctx);
  return ctx;
}
