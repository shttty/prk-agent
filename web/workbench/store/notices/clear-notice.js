import { patchSession } from "../updates/patch-session.js";
export function clearNotice(ctx) { patchSession(ctx, { notice: null }); }

