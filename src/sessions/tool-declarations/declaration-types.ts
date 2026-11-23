import type { ToolInfo } from "@earendil-works/pi-coding-agent";
import type { ToolMode } from "../../config/session/session-options.ts";

/** PRK's request presentation; registrations and execution remain owned by Pi. */
export interface DeclarationTool extends ToolInfo {
  promptSnippet?: string;
  native: boolean;
  enabled: boolean;
  lazy: boolean;
  callable: boolean;
}

export interface DeclarationInput {
  mode: ToolMode;
  tools: readonly DeclarationTool[];
}

export interface ToolDeclarations {
  declared: string[];
  hidden: DeclarationTool[];
  prompt: string;
}
