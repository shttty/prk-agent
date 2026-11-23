import { postJson } from "../requests/post-json.js";
import { nativePath } from "../native-actions/native-path.js";
import { requestId } from "../requests/request-id.js";
import { patchSession } from "../updates/patch-session.js";
export function closeEventSource(ctx) {
    clearTimeout(ctx.renderTimer); ctx.renderTimer = null; ctx.renderPending = null;
    if (ctx.state.session.extensionUiClientId && ctx.state.selectedSessionId && ctx.state.session.connection === "connected") {
      const name = ctx.state.selectedSessionId;
      const clientId = ctx.state.session.extensionUiClientId;
      // Finish the old render before releasing its components. New selections
      // use a new client ID, so late responses/releases cannot affect them.
      void Promise.resolve(ctx.renderFlight).then(() => postJson(ctx, nativePath(ctx, name), {
        requestId: requestId(), action: "extension-ui", args: { operation: "release-client", clientId },
      })).catch(() => {});
      patchSession(ctx, { extensionUiClientId: requestId() });
    }
    if (ctx.source) ctx.source.close();
    ctx.source = null;
  }

