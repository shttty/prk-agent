import { patchSession } from "../updates/patch-session.js";
import { setError } from "../notices/set-error.js";
import { postJson } from "../requests/post-json.js";
import { nativePath } from "../native-actions/native-path.js";
import { requestId } from "../requests/request-id.js";
import { nativeActionResult } from "../native-actions/native-action-result.js";
import { safeText } from "../../payloads/safe-text.js";
import { isRecord } from "../../payloads/is-record.js";
import { acceptExtensionUi } from "./accept-extension-ui.js";
export async function extensionUiAction(ctx, operation, args = {}) {
    const renderRequest = operation === "render" ? ctx.state.session.extensionUiRenderRequest + 1 : 0;
    if (renderRequest) patchSession(ctx, { extensionUiRenderRequest: renderRequest }, { displayOnly: true });
    const name = ctx.state.selectedSessionId;
    if (!name || ctx.state.session.connection !== "connected") return null;
    const background = operation === "render" || operation === "editor" || (operation === "autocomplete" && args.autocompleteOperation !== "apply");
    if (background && !["idle", "running", "cancel_requested"].includes(ctx.state.session.snapshot?.state)) return null;
    const report = (status, detail) => {
      if (background && status === "unavailable") return;
      const fact = background ? "插件界面更新失败。" : status === "unavailable" ? "插件界面已失效。" : "插件操作失败。";
      setError(ctx, status === "unavailable" || !detail ? fact : `${fact} ${detail}`);
    };
    const token = ctx.selectionToken;
    const clientId = ctx.state.session.extensionUiClientId;
    try {
      const result = await postJson(ctx, nativePath(ctx, name), {
        requestId: requestId(),
        action: "extension-ui",
        args: { ...args, operation, clientId },
      });
      if (ctx.disposed || token !== ctx.selectionToken || !(ctx.state.selectedSessionId === name) || clientId !== ctx.state.session.extensionUiClientId) return null;
      if (operation === "render" && renderRequest < ctx.state.session.extensionUiRenderAcceptedRequest) return null;
      if (nativeActionResult(ctx, result) && !["completed", "cancelled"].includes(result.status)) {
        report(result.status, safeText(result.message));
        return null;
      }
      const data = isRecord(result?.data) ? result.data : result;
      if (data?.streamId !== ctx.state.session.streamId) return null;
      if (operation === "render") {
        if (acceptExtensionUi(ctx, data, { rendered: true })) patchSession(ctx, { extensionUiRenderAcceptedRequest: renderRequest }, { displayOnly: true });
      }
      else if (isRecord(data?.extensionUi)) acceptExtensionUi(ctx, data.extensionUi);
      if (typeof data?.status === "string" && !["completed", "cancelled"].includes(data.status)) {
        report(data.status, safeText(data.message));
        return null;
      }
      return data;
    } catch (error) {
      if (!ctx.disposed && token === ctx.selectionToken && (ctx.state.selectedSessionId === name) && clientId === ctx.state.session.extensionUiClientId) report("failed", error instanceof Error ? error.message : "");
      return null;
    }
  }

