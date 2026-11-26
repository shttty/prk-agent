import { createPortal } from "react-dom";
import { Tooltip } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { IconFolder } from "@tabler/icons-react";
import { IconFolderFilled } from "@tabler/icons-react";
import { IconTerminal2 } from "@tabler/icons-react";
import { IconLayoutSidebarRight } from "@tabler/icons-react";
import { IconLayoutSidebarRightFilled } from "@tabler/icons-react";
import { layout } from "../layout/layout-store.js";
import { handFocus } from "../layout/hand-focus.js";
import { toggleWorkspace } from "../page/chrome/toggle-workspace.js";

/** The stage's top-right buttons, one row: while the workspace is open a strip holding a new shell (where one can exist)
 * and the directory (a pinned, open directory has its own collapse button instead), then the control group: reconnect,
 * the layout menu (workspace open) and the workspace toggle (Ctrl+J). `slot`: the chat column's strip slot to render
 * into while the chat holds the stage's top-right corner; otherwise the row floats over that corner. */
export function StageControls({ slot, recoverButton, workspaceAvailable, open, terminalEnabled, treeOpen, treePinned, onNewTerminal, layoutMenu }) {
  const label = open ? "收起工作区" : "展开工作区";
  const row = <div className="pi-stage-corner">
    {open ? <div className="pi-pane-controls pi-stage-strip">
      {terminalEnabled ? <Tooltip label="新终端"><ActionIcon id="new-terminal" variant="subtle" color="gray" aria-label="新终端" onClick={onNewTerminal}><IconTerminal2 size={17} /></ActionIcon></Tooltip> : null}
      {treePinned && treeOpen ? null : <Tooltip label="目录"><ActionIcon id="toggle-tree" variant="subtle" color="gray" aria-label="目录" aria-pressed={treeOpen} onClick={(event) => { layout.set({ treeOpen: !treeOpen }); if (treePinned && !treeOpen) handFocus(event, "collapse-tree"); }}>{treeOpen ? <IconFolderFilled size={17} /> : <IconFolder size={17} />}</ActionIcon></Tooltip>}
    </div> : null}
    <div className="pi-controls" id="workspace-controls">
      {recoverButton}
      {workspaceAvailable && open ? layoutMenu : null}
      {workspaceAvailable
        ? <Tooltip label={`${label}（Ctrl+J）`}><ActionIcon id="toggle-workspace" variant="subtle" color="gray" aria-label={label} aria-expanded={open} onClick={toggleWorkspace}>{open ? <IconLayoutSidebarRightFilled size={17} /> : <IconLayoutSidebarRight size={17} />}</ActionIcon></Tooltip>
        : <span className="pi-controls-slot" aria-hidden="true" />}
    </div>
  </div>;
  return slot ? createPortal(row, slot) : row;
}
