import { patch } from "../updates/patch.js";
import { persistCurrentSession } from "./persist-current-session.js";
export function savePresentation(ctx, update) {
    const previous = ctx.state.presentation;
    const presentation = typeof update === "function" ? update(previous) : update;
    const value = ctx.storage.normalizePresentation({ ...previous, openedTools: undefined, ...presentation });
    // A scroll update leaves the separately observed tool disclosure state unchanged.
    if (previous && !Object.hasOwn(presentation, "openedTools")) value.openedTools = previous.openedTools;
    patch(ctx, { presentation: value });
    persistCurrentSession(ctx);
  }

