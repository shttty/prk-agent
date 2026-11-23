import { getJson } from "../requests/get-json.js";
import { patch } from "../updates/patch.js";
/** Web-local UI config (`GET /api/ui`); a failed read keeps the defaults. */
export async function loadUiConfig(ctx) {
  try {
    const ui = await getJson(ctx, `${ctx.apiRoot}/ui`);
    if (!ctx.disposed) patch(ctx, { extensionUiRenderIntervalMs: ui.extensionUiRenderIntervalMs, gatewayRestartUnit: typeof ui.gatewayRestartUnit === "string" ? ui.gatewayRestartUnit : null });
  } catch { /* render interval and restart unit stay unset */ }
}
