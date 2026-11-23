import { FILE_COMPONENT } from "../../../workspace/editor-layout/editor-layout-constants.js";
import { DIFF_COMPONENT } from "../../../workspace/editor-layout/editor-layout-constants.js";
import { TERMINAL_COMPONENT } from "../../../workspace/editor-layout/editor-layout-constants.js";
import { placePanel } from "./place-panel.js";

const WORK = new Set([FILE_COMPONENT, DIFF_COMPONENT, TERMINAL_COMPONENT]);

const isWorkPanel = (panel) => WORK.has(panel.api.component);

const isWorkGroup = (group) => group.panels.some(isWorkPanel);

/** The stage grid as the workspace engine (editor-dock/engine) expects its dock: only the file, diff and shell tabs and
 * the groups holding them, so its counts, placement and active-tab tracking work unchanged; the chat is invisible to
 * it. While the chat is focused, the active group is the workspace group used last. New tabs land by `placePanel`.
 * `size()`: the grid element's size. Returns the view plus `dispose`. */
export function workspaceView(api, size) {
  let last = null;
  const tracking = api.onDidActiveGroupChange((group) => { if (group && isWorkGroup(group)) last = group; });
  const view = {
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
    onDidLayoutChange: (listener) => api.onDidLayoutChange(listener),
    onDidActivePanelChange: (listener) => api.onDidActivePanelChange(listener),
    onDidRemovePanel: (listener) => api.onDidRemovePanel(listener),
    dispose: () => tracking.dispose(),
  };
  return view;
}
