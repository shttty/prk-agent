import { postJson } from "../requests/post-json.js";
import { patch } from "../updates/patch.js";
import { normalizeSessionControl } from "./normalize-session-control.js";

/** Set root or a project supervisor; the POST returns the authoritative designations (other pages get the event). */
export async function designateRole(ctx, role, sessionId) {
  const control = await postJson(ctx, `${ctx.apiRoot}/session-control/${role}`, { sessionId });
  if (!ctx.disposed) patch(ctx, { sessionControl: normalizeSessionControl(control) });
}
