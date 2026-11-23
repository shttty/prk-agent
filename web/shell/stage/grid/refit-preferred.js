import { fitPreferred } from "./fit-preferred.js";
import { leafExtents } from "./leaf-extents.js";
import { lockChat } from "./lock-chat.js";

const differs = (a, b) => Object.keys(b).some((id) => !a[id] || Math.abs(a[id].width - b[id].width) > 1 || Math.abs(a[id].height - b[id].height) > 1);

/** After the stage changed size: lay the grid out again from the groups' preferred sizes (fitPreferred) where the live
 * layout differs (a group squeezed, or one that can have its size back, or a grid that no longer fits its element), by
 * loading it with the same panels (`reuseExistingPanels`: nothing is rebuilt). Focus stays where it was. `main`: the
 * main area's group id (null: the chat's). */
export function refitPreferred(api, width, height, main, preferred) {
  const dockview = api.toJSON();
  const live = { ...dockview.grid, width, height };
  const target = fitPreferred(live, preferred, width, height, main);
  if (!differs(leafExtents(live), leafExtents(target))) return;
  const focused = document.activeElement;
  api.fromJSON({ ...dockview, grid: target }, { reuseExistingPanels: true });
  lockChat(api);
  api.layout(width, height, true); // its own width can be stale after such a load (see applyPreset)
  if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
}
