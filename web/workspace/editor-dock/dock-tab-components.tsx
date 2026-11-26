import type { IDockviewPanelHeaderProps } from "dockview-react";
import { FILE_COMPONENT } from "../editor-layout/editor-layout-constants.ts";
import { DIFF_COMPONENT } from "../editor-layout/editor-layout-constants.ts";
import { TERMINAL_COMPONENT } from "../editor-layout/editor-layout-constants.ts";
import { PROMPT_COMPONENT } from "../editor-layout/editor-layout-constants.ts";
import { PromptTab } from "../prompt-view/PromptTab.tsx";
import type { FileTabComponent, TerminalTabComponent } from "./editor-dock-types.ts";

type TabParams = { path: string; name: string };

/** dockview tab components for the workspace's file, diff, prompt and shell tabs. */
export const dockTabComponents = ({ FileTab, DiffTab, TerminalTab }: { FileTab: FileTabComponent; DiffTab: FileTabComponent; TerminalTab: TerminalTabComponent }) => ({
  [FILE_COMPONENT]: ({ api, params }: IDockviewPanelHeaderProps<TabParams>) => <FileTab id={api.id} path={params.path} />,
  [DIFF_COMPONENT]: ({ api, params }: IDockviewPanelHeaderProps<TabParams>) => <DiffTab id={api.id} path={params.path} />,
  [PROMPT_COMPONENT]: ({ api }: IDockviewPanelHeaderProps) => <PromptTab id={api.id} />,
  [TERMINAL_COMPONENT]: ({ params }: IDockviewPanelHeaderProps<TabParams>) => <TerminalTab name={params.name} />,
});
