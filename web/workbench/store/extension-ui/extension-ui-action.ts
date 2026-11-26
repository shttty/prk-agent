import type { StoreContext } from "../store-context-types.ts";
import { patchSession } from "../updates/patch-session.ts";
import { setError } from "../notices/set-error.ts";
import { postJson } from "../requests/post-json.ts";
import { nativePath } from "../native-actions/native-path.ts";
import { requestId } from "../requests/request-id.ts";
import { nativeActionResult } from "../native-actions/native-action-result.ts";
import { safeText } from "../../payloads/safe-text.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { acceptExtensionUi } from "./accept-extension-ui.ts";

const FINISHED = ["completed", "cancelled"];

/** One extension UI operation of the selected session. Resolves with the answer's data, or null when it was refused, failed or the page moved on. */
export async function extensionUiAction(ctx: StoreContext, operation: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown> | null> {
  const renderRequest = operation === "render" ? ctx.state.session.extensionUiRenderRequest + 1 : 0;
  if (renderRequest) patchSession(ctx, { extensionUiRenderRequest: renderRequest }, { displayOnly: true });
  const name = ctx.state.selectedSessionId;
  if (!name || ctx.state.session.connection !== "connected") return null;
  const hostState = ctx.state.session.snapshot?.state;
  const background = operation === "render" || operation === "editor" || (operation === "autocomplete" && args.autocompleteOperation !== "apply");
  if (background && hostState !== "idle" && hostState !== "running" && hostState !== "cancel_requested") return null;
  const report = (status: string, detail: string) => {
    if (background && status === "unavailable") return;
    const fact = background ? "插件界面更新失败。" : status === "unavailable" ? "插件界面已失效。" : "插件操作失败。";
    setError(ctx, status === "unavailable" || !detail ? fact : `${fact} ${detail}`);
  };
  const token = ctx.selectionToken;
  const clientId = ctx.state.session.extensionUiClientId;
  const current = () => !ctx.disposed && token === ctx.selectionToken && ctx.state.selectedSessionId === name && clientId === ctx.state.session.extensionUiClientId;
  try {
    const result = await postJson(nativePath(ctx, name), {
      requestId: requestId(),
      action: "extension-ui",
      args: { ...args, operation, clientId },
    });
    if (!current()) return null;
    if (operation === "render" && renderRequest < ctx.state.session.extensionUiRenderAcceptedRequest) return null;
    if (nativeActionResult(result) && !FINISHED.includes(result.status)) {
      report(result.status, safeText(result.message));
      return null;
    }
    const data = isRecord(result) ? (isRecord(result.data) ? result.data : result) : null;
    if (!data || data.streamId !== ctx.state.session.streamId) return null;
    if (operation === "render") {
      if (acceptExtensionUi(ctx, data, { rendered: true })) patchSession(ctx, { extensionUiRenderAcceptedRequest: renderRequest }, { displayOnly: true });
    }
    else if (isRecord(data.extensionUi)) acceptExtensionUi(ctx, data.extensionUi);
    if (typeof data.status === "string" && !FINISHED.includes(data.status)) {
      report(data.status, safeText(data.message));
      return null;
    }
    return data;
  } catch (error) {
    if (current()) report("failed", error instanceof Error ? error.message : "");
    return null;
  }
}
