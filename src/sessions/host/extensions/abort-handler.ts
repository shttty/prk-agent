import type { HostedExtensionsContext } from "../bind-extensions.ts";

export function abortHandler(ctx: HostedExtensionsContext): void {
  const operation = ctx.host.getSnapshot().operation;
  if (operation) void ctx.host.cancel({ operationId: operation.operationId });
}
