import type { StoreContext } from "../store-context-types.ts";
import { getJson } from "../requests/get-json.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { patch } from "../updates/patch.ts";

/** Web-local UI config (`GET /api/ui`); a failed read keeps the defaults. */
export async function loadUiConfig(ctx: StoreContext) {
  try {
    const ui = await getJson(`${ctx.apiRoot}/ui`);
    if (!ctx.disposed && isRecord(ui)) patch(ctx, { extensionUiRenderIntervalMs: typeof ui.extensionUiRenderIntervalMs === "number" ? ui.extensionUiRenderIntervalMs : null, gatewayRestartUnit: typeof ui.gatewayRestartUnit === "string" ? ui.gatewayRestartUnit : null });
  } catch { /* render interval and restart unit stay unset */ }
}
