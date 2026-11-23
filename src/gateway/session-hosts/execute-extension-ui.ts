import { WireError } from "../wire/create-error.ts";
import { requireSource } from "./binding/require-active-source.ts";
import type { HostBindingContext } from "./host-binding-state.ts";

export function extensionUiAction(ctx: HostBindingContext, args: Record<string, unknown>): Promise<unknown> {
  const activeHost = requireSource(ctx);
  if (!activeHost.extensionUiAction) throw new WireError("UNAVAILABLE", "Extension UI is unavailable for this session.");
  if (args.operation === "render" && args.toolContentExpandedIds !== undefined
    && (!Array.isArray(args.toolContentExpandedIds) || args.toolContentExpandedIds.some((id) => typeof id !== "string" || !id || id.length > ctx.parent.host.config.limits.inputBytes || /\p{Cc}/u.test(id)))) {
    throw new WireError("INVALID_REQUEST", "toolContentExpandedIds must be an array of tool call identifiers.");
  }
  if (args.operation === "render" && args.historyStart !== undefined
    && (typeof args.historyStart !== "string" || !args.historyStart || args.historyStart.length > ctx.parent.host.config.limits.identityChars || /\p{Cc}/u.test(args.historyStart))) {
    throw new WireError("INVALID_REQUEST", "historyStart must be a history entry identifier.");
  }
  return Promise.resolve(activeHost.extensionUiAction(args)).then((rendered) => {
    if (args.operation !== "render" || !rendered || typeof rendered !== "object") return rendered;
    return ctx.parent.methods.projectExtensionRender(ctx.sessionId, args, rendered);
  });
}
