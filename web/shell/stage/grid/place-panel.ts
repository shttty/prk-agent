import type { AddPanelOptions } from "dockview-react";
import type { EngineHost } from "../../../workspace/editor-dock/engine/engine-types.ts";
import type { Extent, StageApi } from "./grid-types.ts";
import { layout } from "../../layout/layout-store.ts";
import { KINDS } from "../presets/preset-kinds.ts";
import { placeByPreset } from "../presets/place-by-preset.ts";
import { resolvePreset } from "../presets/resolve-preset.ts";
import { chatGroup } from "./chat-group.ts";

/** Where a new file, diff or shell tab lands: by the layout applied last (every session; see placeByPreset), whatever
 * the workspace engine proposed. `view`: the workspace view (its groups, its active group). `options` are dockview addPanel options;
 * `size`: the grid's `{ width, height }`. Returns the options to add with. */
export function placePanel(api: StageApi, view: EngineHost, options: Omit<AddPanelOptions, "position" | "floating">, size: Extent): AddPanelOptions {
  const chat = chatGroup(api);
  if (!chat) throw new Error("The stage grid has no chat group.");
  const live = {
    chat: chat.id,
    active: view.activeGroup?.id ?? null,
    groups: view.groups.map((group) => ({ id: group.id, kinds: [...new Set(group.panels.flatMap((panel) => KINDS[panel.api.component] ?? []))] })),
  };
  return { ...options, floating: false, ...placeByPreset(resolvePreset(layout.get().lastPreset), KINDS[options.component ?? ""], live, size) };
}
