import { layout } from "../../layout/layout-store.js";
import { KINDS } from "../presets/preset-kinds.js";
import { placeByPreset } from "../presets/place-by-preset.js";
import { resolvePreset } from "../presets/resolve-preset.js";
import { chatGroup } from "./chat-group.js";

/** Where a new file, diff or shell tab lands: by the layout applied last (every session; see placeByPreset), whatever
 * the workspace engine proposed. `view`: the workspace view (its groups, its active group). `options` are dockview addPanel options;
 * `size`: the grid's `{ width, height }`. Returns the options to add with. */
export function placePanel(api, view, options, size) {
  const rest = { ...options };
  delete rest.position;
  const live = {
    chat: chatGroup(api).id,
    active: view.activeGroup?.id ?? null,
    groups: view.groups.map((group) => ({ id: group.id, kinds: [...new Set(group.panels.map((panel) => KINDS[panel.api.component]))] })),
  };
  return { ...rest, ...placeByPreset(resolvePreset(layout.get().lastPreset), KINDS[options.component], live, size) };
}
