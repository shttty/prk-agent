import type { StoreContext } from "../store-context-types.ts";
import type { StoredAttachment } from "../../session-storage/session-storage-types.ts";
import { patch } from "../updates/patch.ts";
import { persistCurrentSession } from "./persist-current-session.ts";

export function setAttachments(ctx: StoreContext, value: StoredAttachment[]) {
  patch(ctx, { attachments: value });
  persistCurrentSession(ctx);
}
