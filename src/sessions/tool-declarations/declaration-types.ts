import type { ToolInfo } from "@earendil-works/pi-coding-agent";
import type { ToolMode } from "../../config/session/session-options.ts";

/** PRK's request presentation; registrations and execution remain owned by Pi. */
export interface DeclarationTool extends ToolInfo {
  promptSnippet?: string;
  /** The tool definition's outputSchema (ToolInfo does not carry it). */
  outputSchema?: unknown;
  /** The settings-page tool group (plugin) the tool belongs to. */
  group?: string;
  native: boolean;
  enabled: boolean;
  lazy: boolean;
  callable: boolean;
}

export interface DeclarationInput {
  mode: ToolMode;
  tools: readonly DeclarationTool[];
  /** Code mode: estimated tokens the catalog's tool stubs may take (`codemode.inlineBudget`). */
  inlineBudget: number;
}

export interface ToolDeclarations {
  declared: string[];
  hidden: DeclarationTool[];
  prompt: string;
}
