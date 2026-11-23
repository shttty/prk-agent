import type { Extension } from "@earendil-works/pi-coding-agent";
import type { InvocationContext } from "./invocation-types.ts";
import { wrap } from "./wrap-handler.ts";

export function handlers(ctx: InvocationContext, extension: Extension, projection: Extension): Extension["handlers"] {
  return new Map([...extension.handlers].map(([event, handlers]) => [event, handlers.map((handler) => wrap(ctx, projection, handler))]));
}
