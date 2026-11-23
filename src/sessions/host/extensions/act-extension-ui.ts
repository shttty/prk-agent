import type { HostContext } from "../host-types.ts";

export const extensionUiAction = async (ctx: HostContext, args: Record<string, unknown>) => ({
  ...(await ctx.options.extensionUi!.action(args) as Record<string, unknown>),
  streamId: ctx.streamId,
  ...(args.operation === "render" ? {} : { extensionUi: ctx.options.extensionUi!.snapshot() }),
});
