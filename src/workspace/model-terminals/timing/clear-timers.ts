import type { Command } from "../model-terminals-types.ts";

export function clearTimers(command: Command): void {
  clearTimeout(command.quietTimer);
  clearTimeout(command.timeoutTimer);
  clearTimeout(command.restartTimer);
}
