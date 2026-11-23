import type { ModelTerminals } from "../../../workspace/model-terminals/model-terminals-types.ts";

export interface TerminalToolsContext {
  readonly terminals: () => ModelTerminals;
}
