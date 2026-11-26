import type { RefObject } from "react";
import type { FitAddon } from "@xterm/addon-fit";
import type { SearchAddon } from "@xterm/addon-search";
import type { Terminal } from "@xterm/xterm";
import type { PageApi } from "../../shell/page/page-types.ts";

/** One entry of the server's terminal list, kept per shell name. */
export type TerminalMetadata = { name?: string; label?: string; owner?: string; generation?: string; cleanup?: string };

/** What a shell's tab and panel in the workspace dock need from the page (see TerminalContext). */
export type TerminalContextValue = {
  api: PageApi;
  sessionId: string;
  place: string;
  enabled: boolean;
  listed: boolean;
  metadata: Record<string, TerminalMetadata>;
  noteGeneration: (name: string, generation: string, cleanup?: string) => void;
  requestEnd: (name: string) => void;
  quote?: (text: string) => void;
};

/** Menu items and keys that act on one shell. */
export type TerminalAction = "copy" | "paste" | "selectAll" | "find" | "quote" | "zoomIn" | "zoomOut" | "zoomReset";

/** The right-click menu's anchor in the terminal view and whether text was selected when it opened. */
export type TerminalMenuState = { x: number; y: number; selection: boolean };

export type TerminalRefs = {
  host: RefObject<HTMLDivElement | null>;
  term: RefObject<Terminal | null>;
  fit: RefObject<FitAddon | null>;
  search: RefObject<SearchAddon | null>;
};
