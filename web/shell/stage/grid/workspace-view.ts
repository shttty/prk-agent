import type { DockviewGroupPanel, IDockviewPanel } from "dockview-react";
import type { EngineHost } from "../../../workspace/editor-dock/engine/engine-types.ts";
import type { Extent, StageApi } from "./grid-types.ts";
import { FILE_COMPONENT } from "../../../workspace/editor-layout/editor-layout-constants.ts";
import { DIFF_COMPONENT } from "../../../workspace/editor-layout/editor-layout-constants.ts";
import { TERMINAL_COMPONENT } from "../../../workspace/editor-layout/editor-layout-constants.ts";
import { PROMPT_COMPONENT } from "../../../workspace/editor-layout/editor-layout-constants.ts";
import { placePanel } from "./place-panel.ts";

const WORK = new Set([FILE_COMPONENT, DIFF_COMPONENT, TERMINAL_COMPONENT, PROMPT_COMPONENT]);

const isWorkPanel = (panel: IDockviewPanel) => WORK.has(panel.api.component);

const isWorkGroup = (group: DockviewGroupPanel) => group.panels.some(isWorkPanel);

/** The stage grid as the workspace engine (editor-dock/engine) expects its dock: only the file, diff, prompt and shell tabs and
 * the groups holding them, so its counts, placement and active-tab tracking work unchanged; the chat is invisible to
 * it. While the chat is focused, the active group is the workspace group used last. New tabs land by `placePanel`.
 * `size()`: the grid element's size. Returns the view plus `dispose`. */
export function workspaceView(api: StageApi, size: () => Extent): EngineHost & { dispose: () => void } {
  let last: DockviewGroupPanel | null = null;
  const tracking = api.onDidActiveGroupChange((group) => { if (group && isWorkGroup(group)) last = group; });
  const view: EngineHost & { dispose: () => void } = {
    get panels() { return api.panels.filter(isWorkPanel); },
    get groups() { return api.groups.filter(isWorkGroup); },
    get activeGroup() {
      const group = api.activeGroup;
      if (group && isWorkGroup(group)) return group;
      return last && api.groups.includes(last) && isWorkGroup(last) ? last : undefined;
    },
    get activePanel() { const panel = api.activePanel; return panel && isWorkPanel(panel) ? panel : undefined; },
    getPanel: (id) => api.getPanel(id),
    addPanel: (options) => api.addPanel(placePanel(api, view, options, size())),
    toJSON: () => api.toJSON(),
    fromJSON: (data, options) => api.fromJSON(data, options),
    clear: () => api.clear(),
    onDidLayoutChange: (listener) => api.onDidLayoutChange(listener),
    onDidActivePanelChange: (listener) => api.onDidActivePanelChange(listener),
    onDidRemovePanel: (listener) => api.onDidRemovePanel(listener),
    dispose: () => tracking.dispose(),
  };
  return view;
}
