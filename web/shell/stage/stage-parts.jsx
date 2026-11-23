import { createContext } from "react";
import { useContext } from "react";
import { lazy } from "react";
import { dockComponents } from "../../workspace/editor-dock/dock-components.jsx";
import { dockTabComponents } from "../../workspace/editor-dock/dock-tab-components.jsx";
import { FilePanel } from "../../workspace/file-editor/FilePanel.jsx";
import { FileTab } from "../../workspace/file-editor/FileTab.jsx";
import { DiffPanel } from "../../workspace/diff-view/DiffPanel.jsx";
import { DiffTab } from "../../workspace/diff-view/DiffTab.jsx";
import { TerminalTab } from "../../workspace/terminal/TerminalTab.jsx";
import { CHAT_COMPONENT } from "./grid/stage-constants.js";

// xterm stays out of the stage chunk; it loads when a shell's tab first renders.
const TerminalDockPanel = lazy(() => import("../../workspace/terminal/TerminalDockPanel.jsx"));

/** The chat column the page built for the stage's chat panel (dockview-react portals keep React context). */
export const StageChat = createContext(null);

function ChatPart() { return useContext(StageChat); }

export const STAGE_COMPONENTS = { [CHAT_COMPONENT]: ChatPart, ...dockComponents({ FilePanel, DiffPanel, TerminalPanel: TerminalDockPanel }) };

export const STAGE_TABS = dockTabComponents({ FileTab, DiffTab, TerminalTab });
