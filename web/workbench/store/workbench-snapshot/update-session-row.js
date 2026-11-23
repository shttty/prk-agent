import { patch } from "../updates/patch.js";
export function updateSessionRow(ctx, name, changes) {
    if (!name) return;
    const previous = ctx.state.sessions.get(name) || { sessionId: name, state: "idle" };
    const sessions = new Map(ctx.state.sessions).set(name, { ...previous, ...changes, sessionId: name });
    patch(ctx, { sessions });
  }

