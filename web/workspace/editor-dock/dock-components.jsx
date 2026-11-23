import { FILE_COMPONENT } from "../editor-layout/editor-layout-constants.js";
import { DIFF_COMPONENT } from "../editor-layout/editor-layout-constants.js";
import { TERMINAL_COMPONENT } from "../editor-layout/editor-layout-constants.js";
import { FilePanelPart } from "./FilePanelPart.jsx";
import { TerminalPanelPart } from "./TerminalPanelPart.jsx";

/** dockview panel components for the workspace's file, diff and shell tabs (`TerminalPanel` may be lazy). */
export const dockComponents = ({ FilePanel, DiffPanel, TerminalPanel }) => ({
  [FILE_COMPONENT]: ({ api, params }) => <FilePanelPart Panel={FilePanel} api={api} params={params} />,
  [DIFF_COMPONENT]: ({ api, params }) => <FilePanelPart Panel={DiffPanel} api={api} params={params} />,
  [TERMINAL_COMPONENT]: ({ api, containerApi, params }) => <TerminalPanelPart Panel={TerminalPanel} api={api} containerApi={containerApi} params={params} />,
});
