import type { TerminalNotice } from "../model-terminals/model-terminals-types.ts";

export interface NotificationContext {
  pending: TerminalNotice[];
  timer: NodeJS.Timeout | undefined;
}
