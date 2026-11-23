import type { TerminalOptions } from "../../config/terminal/terminal-options.ts";
import type { ModelTerminals } from "../../workspace/model-terminals/model-terminals-types.ts";
import type { TargetFiles } from "../../workspace/target-files/files-types.ts";
import type { WorkspaceTerminals } from "../../workspace/terminals/terminals-types.ts";

export interface WorkspaceState {
  terminalOptions: TerminalOptions;
  modelTerminals: Map<string, ModelTerminals>;
  files: TargetFiles;
  terminals: WorkspaceTerminals;
}
