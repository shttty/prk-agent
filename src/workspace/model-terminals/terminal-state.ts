import type { TerminalNotice } from "./model-terminals-types.ts";
import type { ModelTerminalContext } from "./model-terminals-types.ts";
import type { Command } from "./model-terminals-types.ts";
import type { ModelTerminal } from "./model-terminals-types.ts";
import type { TerminalSummary } from "../terminals/terminals-types.ts";

export interface ModelTerminalsContext extends ModelTerminalContext {
  readonly entries: Map<string, ModelTerminal>;
  readonly openings: Map<string, Promise<ModelTerminal>>;
  readonly restartTasks: Map<string, Promise<void>>;
  readonly restartErrors: Map<string, Error>;
  readonly history: Map<string, Command>;
  historyBytes: number;
  readonly listeners: Set<(event: TerminalNotice) => void>;
  readonly stateListeners: Set<(terminals: readonly TerminalSummary[]) => void>;
  stopped: boolean;
}
