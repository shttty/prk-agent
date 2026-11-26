import type { Extents, GridSize, StageApi } from "../grid/grid-types.ts";
import type { AskedSize, Preset } from "./preset-types.ts";
import { lockChat } from "../grid/lock-chat.ts";
import { leafExtents } from "../grid/leaf-extents.ts";
import { chatGroup } from "../grid/chat-group.ts";
import { stageGrid } from "../grid/grid-of.ts";
import { arrangeByPreset } from "./arrange-by-preset.ts";

/** Re-arrange the stage grid `api` by a layout at once (no confirmation): the open panels move into its groups without
 * being rebuilt (dockview's public `fromJSON(..., { reuseExistingPanels: true })`), so running shells, unsaved text and
 * scroll positions stay. `size()`: the grid element's size (dockview's own `api.width` can be stale after such a load
 * from a nested grid, 8.5.1). Returns `{ main, preferred }`: the main area's group id (null: the chat's) and the other
 * groups' preferred sizes (what the layout asks, else their size as laid out); the caller records them and opens or
 * closes the workspace as the layout says. */
export function applyPreset(api: StageApi, preset: Preset, size: GridSize) {
  if (api.hasMaximizedGroup()) api.exitMaximizedGroup();
  const { width, height } = size();
  const { dockview, main, asked } = arrangeByPreset(preset, api.toJSON(), width, height);
  api.fromJSON(dockview, { reuseExistingPanels: true });
  lockChat(api);
  api.layout(width, height, true);
  const laid = leafExtents(stageGrid(dockview.grid));
  const anchor = main ?? chatGroup(api)?.id;
  const preferred: Extents = Object.fromEntries(Object.entries(laid).filter(([id]) => id !== anchor).map(([id, extent]) => [id, { ...extent, ...asked[id] satisfies AskedSize | undefined }]));
  return { main, preferred };
}
