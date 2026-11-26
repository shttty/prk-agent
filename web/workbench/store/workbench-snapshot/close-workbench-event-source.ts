import type { StoreContext } from "../store-context-types.ts";

export function closeWorkbenchEventSource(ctx: StoreContext) {
  if (ctx.workbenchSource) ctx.workbenchSource.close();
  ctx.workbenchSource = null;
}
