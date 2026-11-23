import { replaceSession } from "../updates/replace-session.js";
import { patch } from "../updates/patch.js";
export function clearSessionState(ctx) {
    replaceSession(ctx);
    patch(ctx, { draft: "", attachments: [], references: [], presentation: null });
  }

