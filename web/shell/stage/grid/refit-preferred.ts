import type { Extents, StageApi } from "./grid-types.ts";
import { fitPreferred } from "./fit-preferred.ts";
import { leafExtents } from "./leaf-extents.ts";
import { lockChat } from "./lock-chat.ts";
import { stageGrid } from "./grid-of.ts";

const differs = (a: Extents, b: Extents) => Object.keys(b).some((id) => {
  const was = a[id];
  const now = b[id];
  return !was || !now || Math.abs(was.width - now.width) > 1 || Math.abs(was.height - now.height) > 1;
});

/** After the stage changed size: lay the grid out again from the groups' preferred sizes (fitPreferred) where the live
 * layout differs (a group squeezed, or one that can have its size back, or a grid that no longer fits its element), by
 * loading it with the same panels (`reuseExistingPanels`: nothing is rebuilt). Focus stays where it was. `main`: the
 * main area's group id (null: the chat's). */
export function refitPreferred(api: StageApi, width: number, height: number, main: string | null, preferred: Extents) {
  const dockview = api.toJSON();
  const live = { ...stageGrid(dockview.grid), width, height };
  const target = fitPreferred(live, preferred, width, height, main);
  if (!differs(leafExtents(live), leafExtents(target))) return;
  const focused = document.activeElement;
  api.fromJSON({ ...dockview, grid: target }, { reuseExistingPanels: true });
  lockChat(api);
  api.layout(width, height, true); // its own width can be stale after such a load (see applyPreset)
  if (focused instanceof HTMLElement && focused.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
}
