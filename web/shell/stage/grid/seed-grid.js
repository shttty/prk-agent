import { parseSavedLayout } from "../../../workspace/editor-layout/parse-saved-layout.js";
import { CHAT_ID } from "./stage-constants.js";
import { CHAT_COMPONENT } from "./stage-constants.js";
import { holdsChat } from "./stage-constants.js";
import { leaves } from "../../../workspace/editor-layout/leaves.js";
import { fitPreferred } from "./fit-preferred.js";
import { leafExtents } from "./leaf-extents.js";
import { lockChat } from "./lock-chat.js";

const isSize = (size) => size && Number.isFinite(size.width) && Number.isFinite(size.height);

/** Restore a session's saved stage grid (`saved`: dockview JSON plus `main`, the main area's group id, and
 * `preferred`, the other groups' preferred sizes), laid out for the grid element's `{ width, height }` from those
 * preferences (fitPreferred), or start with the chat alone. A grid that is not one this stage wrote is dropped; a group
 * without a saved preference prefers its saved size. Returns `{ main, preferred }` (main null: the chat's). */
export function seedGrid(api, saved, { width, height }) {
  const layout = saved ? parseSavedLayout(JSON.stringify(saved), { [CHAT_ID]: CHAT_COMPONENT }) : null;
  const extents = layout ? leafExtents(layout.grid) : {};
  const main = Object.hasOwn(extents, saved?.main) ? saved.main : null;
  const anchor = main ?? (layout ? leaves(layout.grid.root).find(holdsChat)?.id : null);
  const preferred = Object.fromEntries(Object.entries(extents).filter(([id]) => id !== anchor).map(([id, size]) => [id, isSize(saved.preferred?.[id]) ? saved.preferred[id] : size]));
  if (layout) {
    try { api.fromJSON(width && height ? { ...layout, grid: fitPreferred(layout.grid, preferred, width, height, main) } : layout); } catch { api.clear(); }
  }
  if (!api.getPanel(CHAT_ID)) {
    api.clear();
    api.addPanel({ id: CHAT_ID, component: CHAT_COMPONENT, title: CHAT_COMPONENT });
    lockChat(api);
    return { main: null, preferred: {} };
  }
  lockChat(api);
  return { main: main && api.getGroup(main) ? main : null, preferred };
}
