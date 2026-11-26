import type { ReactNode } from "react";
import { createContext } from "react";
import { useContext } from "react";
import { lazy } from "react";
import { dockComponents } from "../../workspace/editor-dock/dock-components.tsx";
import { dockTabComponents } from "../../workspace/editor-dock/dock-tab-components.tsx";
import { FilePanel } from "../../workspace/file-editor/FilePanel.tsx";
import { FileTab } from "../../workspace/file-editor/FileTab.tsx";
import { DiffPanel } from "../../workspace/diff-view/DiffPanel.tsx";
import { DiffTab } from "../../workspace/diff-view/DiffTab.tsx";
import { TerminalTab } from "../../workspace/terminal/TerminalTab.tsx";
import { CHAT_COMPONENT } from "./grid/stage-constants.ts";

// xterm stays out of the stage chunk; it loads when a shell's tab first renders.
const TerminalDockPanel = lazy(() => import("../../workspace/terminal/TerminalDockPanel.tsx"));

/** The chat column the page built for the stage's chat panel (dockview-react portals keep React context). */
export const StageChat = createContext<ReactNode>(null);

function ChatPart() { return useContext(StageChat); }

export const STAGE_COMPONENTS = { [CHAT_COMPONENT]: ChatPart, ...dockComponents({ FilePanel, DiffPanel, TerminalPanel: TerminalDockPanel }) };

export const STAGE_TABS = dockTabComponents({ FileTab, DiffTab, TerminalTab });
