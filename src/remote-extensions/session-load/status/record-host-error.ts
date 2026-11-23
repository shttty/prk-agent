import type { LoadContext } from "../load-types.ts";
import { publish } from "./publish-status.ts";

export function recordHostError(ctx: LoadContext, error: Error): void {
  for (const status of ctx.remoteStatuses.values()) status.error = error.message;
  publish(ctx);
}
