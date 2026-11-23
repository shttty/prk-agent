import type { Extension } from "@earendil-works/pi-coding-agent";
import type { InvocationContext, Handler } from "./invocation-types.ts";
import { wrapped } from "./wrapped.ts";

export function wrap(ctx: InvocationContext, extension: Extension, handler: Handler): Handler {
  let wrappers = ctx.wrappers.get(extension);
  if (!wrappers) ctx.wrappers.set(extension, wrappers = new WeakMap());
  const existing = wrappers.get(handler);
  if (existing) return existing;
  const result: Handler = (...args) => wrapped(ctx, extension, handler, args);
  wrappers.set(handler, result);
  return result;
}
