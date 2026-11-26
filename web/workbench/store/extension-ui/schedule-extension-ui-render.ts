import type { StoreContext } from "../store-context-types.ts";
import { extensionUiAction } from "./extension-ui-action.ts";

export function scheduleExtensionUiRender(ctx: StoreContext) {
  if (ctx.disposed || ctx.renderFlight || ctx.renderTimer !== undefined || !ctx.renderPending || !ctx.state.extensionUiRenderIntervalMs) return;
  const delay = Math.max(0, ctx.renderStartedAt + ctx.state.extensionUiRenderIntervalMs - Date.now());
  ctx.renderTimer = setTimeout(() => {
    ctx.renderTimer = undefined;
    const args = ctx.renderPending;
    ctx.renderPending = null;
    ctx.renderStartedAt = Date.now();
    const flight = extensionUiAction(ctx, "render", args ?? {});
    ctx.renderFlight = flight;
    void flight.finally(() => {
      if (ctx.renderFlight !== flight) return;
      ctx.renderFlight = null;
      scheduleExtensionUiRender(ctx);
    });
  }, delay);
}
