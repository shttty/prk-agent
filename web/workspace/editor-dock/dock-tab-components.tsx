import type { IDockviewPanelHeaderProps } from "dockview-react";
import { FILE_COMPONENT } from "../editor-layout/editor-layout-constants.ts";
import { DIFF_COMPONENT } from "../editor-layout/editor-layout-constants.ts";
import { TERMINAL_COMPONENT } from "../editor-layout/editor-layout-constants.ts";
import type { FileTabComponent, TerminalTabComponent } from "./editor-dock-types.ts";

type TabParams = { path: string; name: string };

/** dockview tab components for the workspace's file, diff and shell tabs. */
export const dockTabComponents = ({ FileTab, DiffTab, TerminalTab }: { FileTab: FileTabComponent; DiffTab: FileTabComponent; TerminalTab: TerminalTabComponent }) => ({
  [FILE_COMPONENT]: ({ api, params }: IDockviewPanelHeaderProps<TabParams>) => <FileTab id={api.id} path={params.path} />,
  [DIFF_COMPONENT]: ({ api, params }: IDockviewPanelHeaderProps<TabParams>) => <DiffTab id={api.id} path={params.path} />,
  [TERMINAL_COMPONENT]: ({ params }: IDockviewPanelHeaderProps<TabParams>) => <TerminalTab name={params.name} />,
});
