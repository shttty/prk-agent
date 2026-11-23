import { gridKey } from "../../../web/shell/layout/layout-store.js";
import { CHAT_ID, CHAT_COMPONENT } from "../../../web/shell/stage/grid/stage-constants.js";
import { FILE_COMPONENT, TERMINAL_COMPONENT } from "../../../web/workspace/editor-layout/editor-layout-constants.js";
import { terminalPanelId } from "../../../web/workspace/editor-layout/terminal-panel-id.js";

/** Desktop localStorage entries with the locked chat, `path` in its own group, and shell `name` in a third group.
 * Pair with a mock listing the shell (`terminals: [{ name }]`), or its restored tab is dropped as gone. */
export function splitDockStorage(sessionId, path, name = "shell") {
  const id = terminalPanelId(name);
  const layout = {
    grid: {
      root: { type: "branch", size: 600, data: [
        { type: "leaf", size: 400, data: { id: "chat", views: [CHAT_ID], activeView: CHAT_ID, locked: true, hideHeader: true } },
        { type: "leaf", size: 400, data: { id: "1", views: ["f1"], activeView: "f1" } },
        { type: "leaf", size: 400, data: { id: "2", views: [id], activeView: id } },
      ] },
      width: 1200, height: 600, orientation: "HORIZONTAL",
    },
    panels: {
      [CHAT_ID]: { id: CHAT_ID, contentComponent: CHAT_COMPONENT, title: CHAT_COMPONENT },
      f1: { id: "f1", contentComponent: FILE_COMPONENT, tabComponent: FILE_COMPONENT, params: { path }, title: path },
      [id]: { id, contentComponent: TERMINAL_COMPONENT, tabComponent: TERMINAL_COMPONENT, params: { name }, title: name, renderer: "always" },
    },
    activeGroup: "1",
  };
  return { [gridKey(sessionId)]: JSON.stringify(layout) };
}
