import type { StoreContext } from "../store-context-types.ts";
import { postJson } from "../requests/post-json.ts";
import { nativePath } from "../native-actions/native-path.ts";
import { requestId } from "../requests/request-id.ts";
import { patchSession } from "../updates/patch-session.ts";

export function closeEventSource(ctx: StoreContext) {
  clearTimeout(ctx.renderTimer);
  ctx.renderTimer = undefined;
  ctx.renderPending = null;
  const name = ctx.state.selectedSessionId;
  if (ctx.state.session.extensionUiClientId && name && ctx.state.session.connection === "connected") {
    const clientId = ctx.state.session.extensionUiClientId;
    // Finish the old render before releasing its components. New selections
    // use a new client ID, so late responses/releases cannot affect them.
    void Promise.resolve(ctx.renderFlight).then(() => postJson(nativePath(ctx, name), {
      requestId: requestId(), action: "extension-ui", args: { operation: "release-client", clientId },
    })).catch(() => {});
    patchSession(ctx, { extensionUiClientId: requestId() });
  }
  if (ctx.source) ctx.source.close();
  ctx.source = null;
}
