import type { StoreContext } from "../store-context-types.ts";
import { postJson } from "../requests/post-json.ts";
import { patch } from "../updates/patch.ts";
import { normalizeSessionControl } from "./normalize-session-control.ts";

/** Set root or a project supervisor; the POST returns the authoritative designations (other pages get the event). */
export async function designateRole(ctx: StoreContext, role: string, sessionId: string) {
  const control = await postJson(`${ctx.apiRoot}/session-control/${role}`, { sessionId });
  if (!ctx.disposed) patch(ctx, { sessionControl: normalizeSessionControl(control) });
}
