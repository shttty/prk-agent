import type { ComponentType } from "react";

/** The workspace panels and tabs the dock renders, supplied by the page region (the terminal panel may be lazy). */
export type FilePanelComponent = ComponentType<{ id: string; path: string; visible: boolean }>;
export type FileTabComponent = ComponentType<{ id: string; path: string }>;
export type TerminalPanelComponent = ComponentType<{ name: string; visible: boolean; onEnded: () => void }>;
export type TerminalTabComponent = ComponentType<{ name: string }>;
