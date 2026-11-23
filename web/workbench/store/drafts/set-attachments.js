import { patch } from "../updates/patch.js";
import { persistCurrentSession } from "./persist-current-session.js";
export function setAttachments(ctx, value) {
    patch(ctx, { attachments: Array.isArray(value) ? value : [] });
    persistCurrentSession(ctx);
  }

