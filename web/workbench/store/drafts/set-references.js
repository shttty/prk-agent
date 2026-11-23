import { patch } from "../updates/patch.js";
import { persistCurrentSession } from "./persist-current-session.js";
export function setReferences(ctx, value) { patch(ctx, { references: Array.isArray(value) ? value : [] }); persistCurrentSession(ctx); }

