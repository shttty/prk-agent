import type { StoreContext } from "../store-context-types.ts";
import type { Presentation } from "../../session-storage/session-storage-types.ts";
import { patch } from "../updates/patch.ts";
import { persistCurrentSession } from "./persist-current-session.ts";

export function savePresentation(ctx: StoreContext, update: Partial<Presentation> | ((previous: Presentation | null) => Partial<Presentation>)) {
  const previous = ctx.state.presentation;
  const presentation = typeof update === "function" ? update(previous) : update;
  const value = ctx.storage.normalizePresentation({ ...previous, openedTools: undefined, ...presentation });
  // A scroll update leaves the separately observed tool disclosure state unchanged.
  if (previous && !Object.hasOwn(presentation, "openedTools")) value.openedTools = previous.openedTools;
  patch(ctx, { presentation: value });
  persistCurrentSession(ctx);
}
