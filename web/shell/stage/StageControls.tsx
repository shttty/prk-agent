import type { ReactNode } from "react";
import { ActionIcon, Group, Tooltip } from "@mantine/core";
import { IconFolder, IconFolderFilled, IconLayoutSidebarRight, IconLayoutSidebarRightFilled, IconTerminal2 } from "@tabler/icons-react";
import { layout } from "../layout/layout-store.ts";
import { handFocus } from "../layout/hand-focus.ts";
import { toggleWorkspace } from "../page/chrome/toggle-workspace.ts";

type StageControlsProps = {
  recoverButton: ReactNode;
  workspaceAvailable: boolean;
  open: boolean;
  terminalEnabled: boolean;
  treeOpen: boolean;
  treePinned: boolean;
  onNewTerminal: () => void;
  layoutMenu: ReactNode;
  debugMenu: ReactNode;
};

/** The stage's top-right buttons, one row: while the workspace is open a strip holding a new shell (where one can exist),
 * the debug tools (in debug mode) and the directory (a pinned, open directory has its own collapse button instead), then the control group: reconnect,
 * the layout menu (workspace open) and the workspace toggle (Ctrl+J). The row is plain content: the page renders it where
 * the stage's top-right corner is (see StageControlsContext). */
export function StageControls({ recoverButton, workspaceAvailable, open, terminalEnabled, treeOpen, treePinned, onNewTerminal, layoutMenu, debugMenu }: StageControlsProps) {
  const label = open ? "收起工作区" : "展开工作区";
  return <Group gap={2} wrap="nowrap">
    {open ? <Group gap={2} wrap="nowrap" className="pi-pane-controls pi-stage-strip">
      {terminalEnabled ? <Tooltip label="新终端"><ActionIcon id="new-terminal" size={26} variant="subtle" color="gray" aria-label="新终端" onClick={onNewTerminal}><IconTerminal2 size={17} /></ActionIcon></Tooltip> : null}
      {treePinned && treeOpen ? null : <Tooltip label="目录"><ActionIcon id="toggle-tree" size={26} variant="subtle" color="gray" aria-label="目录" aria-pressed={treeOpen} onClick={(event) => { layout.set({ treeOpen: !treeOpen }); if (treePinned && !treeOpen) handFocus(event, "collapse-tree"); }}>{treeOpen ? <IconFolderFilled size={17} /> : <IconFolder size={17} />}</ActionIcon></Tooltip>}
      {debugMenu}
    </Group> : null}
    <Group gap={2} wrap="nowrap" id="workspace-controls" className="pi-controls">
      {recoverButton}
      {workspaceAvailable && open ? layoutMenu : null}
      {workspaceAvailable
        ? <Tooltip label={`${label}（Ctrl+J）`}><ActionIcon id="toggle-workspace" size={26} variant="subtle" color="gray" aria-label={label} aria-expanded={open} onClick={toggleWorkspace}>{open ? <IconLayoutSidebarRightFilled size={17} /> : <IconLayoutSidebarRight size={17} />}</ActionIcon></Tooltip>
        : null}
    </Group>
  </Group>;
}
