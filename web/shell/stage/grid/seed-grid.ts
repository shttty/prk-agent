import type { Extent, Extents, StageApi } from "./grid-types.ts";
import { parseSavedLayout } from "../../../workspace/editor-layout/parse-saved-layout.ts";
import { isRecord } from "../../../workspace/editor-layout/is-record.ts";
import { CHAT_ID } from "./stage-constants.ts";
import { CHAT_COMPONENT } from "./stage-constants.ts";
import { holdsChat } from "./stage-constants.ts";
import { leaves } from "../../../workspace/editor-layout/leaves.ts";
import { fitPreferred } from "./fit-preferred.ts";
import { leafExtents } from "./leaf-extents.ts";
import { lockChat } from "./lock-chat.ts";
import { stageGrid } from "./grid-of.ts";

const isSize = (size: unknown): size is Extent => isRecord(size) && typeof size.width === "number" && Number.isFinite(size.width) && typeof size.height === "number" && Number.isFinite(size.height);

/** Restore a session's saved stage grid (`saved`: dockview JSON plus `main`, the main area's group id, and
 * `preferred`, the other groups' preferred sizes), laid out for the grid element's `{ width, height }` from those
 * preferences (fitPreferred), or start with the chat alone. A grid that is not one this stage wrote is dropped; a group
 * without a saved preference prefers its saved size. Returns `{ main, preferred }` (main null: the chat's). */
export function seedGrid(api: StageApi, saved: unknown, { width, height }: Extent): { main: string | null; preferred: Extents } {
  const layout = isRecord(saved) ? parseSavedLayout(JSON.stringify(saved), { [CHAT_ID]: CHAT_COMPONENT }) : null;
  const savedRecord = isRecord(saved) ? saved : {};
  const grid = layout ? stageGrid(layout.grid) : null;
  const extents = grid ? leafExtents(grid) : {};
  const savedMain = savedRecord.main;
  const main = typeof savedMain === "string" && Object.hasOwn(extents, savedMain) ? savedMain : null;
  const anchor = main ?? (layout ? leaves(layout.grid.root)?.find(holdsChat)?.id : null);
  const savedPreferred = isRecord(savedRecord.preferred) ? savedRecord.preferred : {};
  const preferred: Extents = Object.fromEntries(Object.entries(extents).filter(([id]) => id !== anchor).map(([id, size]) => { const wanted = savedPreferred[id]; return [id, isSize(wanted) ? wanted : size]; }));
  if (layout && grid) {
    try { api.fromJSON(width && height ? { ...layout, grid: fitPreferred(grid, preferred, width, height, main) } : layout); } catch { api.clear(); }
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
