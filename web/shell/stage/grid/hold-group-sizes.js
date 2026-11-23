import { layout } from "../../layout/layout-store.js";
import { splitAxes } from "./split-axes.js";
import { chatGroup } from "./chat-group.js";
import { lockChat } from "./lock-chat.js";
import { refitPreferred } from "./refit-preferred.js";
import { leafExtents } from "./leaf-extents.js";
import { GROUP_LIMITS } from "./stage-constants.js";

/** The main area (`main()`: its group id; null: the chat's) absorbs changes of the stage's own size (window, session
 * sidebar, pinned directory column): the groups around it keep theirs. dockview groups have no layout priority, so
 * while the stage resizes every other group is held at its size along the split that separates it from the main area
 * (min = max through the public `setConstraints`; the axis comes from the serialized grid), and released 200 ms after
 * the last change. Held permanently, dockview would disable their handles. The triggers fire before the new size is
 * laid out: the window's `resize` event and the layout store (sidebar width or folding, directory column), which App
 * and the stage render from. On release the grid is laid out from the groups' preferred sizes (`sizing`, see
 * preferredSizes and refitPreferred): groups squeezed under the main area's floor give way, and get their size back
 * when the room returns. Layout changes in between are passive for `sizing`. `size()`: the grid element's size, laid
 * out on release (see applyPreset). Returns `{ dispose }`. */
export function holdGroupSizes(api, main, size, sizing) {
  let held = false;
  let timer = 0;
  const anchor = () => (main() && api.getGroup(main())) || chatGroup(api);
  const others = () => { const kept = anchor(); return api.groups.filter((group) => group !== kept); };
  const release = () => {
    held = false;
    for (const group of others()) { if (group === chatGroup(api)) lockChat(api); else group.api.setConstraints(GROUP_LIMITS); }
    const { width, height } = size();
    api.layout(width, height, true); // dockview re-enables the handles only when it lays out
    refitPreferred(api, width, height, main(), sizing.get());
    sizing.settle(leafExtents({ ...api.toJSON().grid, width, height }));
  };
  const hold = () => {
    if (api.hasMaximizedGroup()) return;
    if (!held) {
      held = true;
      sizing.squeezing();
      const kept = anchor().id;
      const axes = splitAxes(api.toJSON().grid, (group) => group.id === kept);
      for (const group of others()) {
        const axis = axes.get(group.id);
        const size = Math.round(axis === "x" ? group.api.width : group.api.height);
        if (!axis || !size) continue;
        group.api.setConstraints(axis === "x" ? { ...GROUP_LIMITS, minimumWidth: size, maximumWidth: size } : { ...GROUP_LIMITS, minimumHeight: size, maximumHeight: size });
      }
    }
    clearTimeout(timer);
    timer = setTimeout(release, 200); // after dockview's own (frame-deferred) layout of the new size
  };
  // Only layout values that change the stage's own size: a popover directory opening or closing must not hold the
  // groups (a split or drop right after it would then take its room from the main area instead).
  const frame = () => { const s = layout.get(); const pinned = s.treePinned && s.treeOpen; return [s.sessionOpen, s.sessionOpen ? s.sessionWidth : 0, pinned, pinned ? s.treeWidth : 0].join(); };
  let seen = frame();
  window.addEventListener("resize", hold);
  const unsubscribe = layout.subscribe(() => { const next = frame(); if (next !== seen) { seen = next; hold(); } });
  const added = api.onDidAddGroup((group) => { if (group !== chatGroup(api)) group.api.setConstraints(GROUP_LIMITS); });
  for (const group of api.groups) if (group !== chatGroup(api)) group.api.setConstraints(GROUP_LIMITS);
  return { dispose() { clearTimeout(timer); window.removeEventListener("resize", hold); unsubscribe(); added.dispose(); } };
}
