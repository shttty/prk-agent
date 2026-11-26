import type { IDockviewPanelProps } from "dockview-react";
import { FILE_COMPONENT } from "../editor-layout/editor-layout-constants.ts";
import { DIFF_COMPONENT } from "../editor-layout/editor-layout-constants.ts";
import { TERMINAL_COMPONENT } from "../editor-layout/editor-layout-constants.ts";
import { FilePanelPart } from "./FilePanelPart.tsx";
import { TerminalPanelPart } from "./TerminalPanelPart.tsx";
import type { FilePanelComponent, TerminalPanelComponent } from "./editor-dock-types.ts";

type PanelParams = { path: string; name: string };

/** dockview panel components for the workspace's file, diff and shell tabs (`TerminalPanel` may be lazy). */
export const dockComponents = ({ FilePanel, DiffPanel, TerminalPanel }: { FilePanel: FilePanelComponent; DiffPanel: FilePanelComponent; TerminalPanel: TerminalPanelComponent }) => ({
  [FILE_COMPONENT]: ({ api, params }: IDockviewPanelProps<PanelParams>) => <FilePanelPart Panel={FilePanel} api={api} params={params} />,
  [DIFF_COMPONENT]: ({ api, params }: IDockviewPanelProps<PanelParams>) => <FilePanelPart Panel={DiffPanel} api={api} params={params} />,
  [TERMINAL_COMPONENT]: ({ api, containerApi, params }: IDockviewPanelProps<PanelParams>) => <TerminalPanelPart Panel={TerminalPanel} api={api} containerApi={containerApi} params={params} />,
});
