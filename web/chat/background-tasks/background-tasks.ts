import { taskName } from "../../../shared/background-task-name.ts";
import type { BackgroundTask, KernelCell, TerminalInfo } from "./background-task-types.ts";

export function backgroundTasks(cells: readonly KernelCell[], terminals: readonly TerminalInfo[] | null | undefined): BackgroundTask[] {
  const kernel = cells.map((cell): BackgroundTask => ({ ...cell, kind: "kernel", id: cell.cellId, key: `${cell.kernelId}:${cell.cellId}`, displayName: cell.taskName }));
  const terminalTasks = (terminals || []).flatMap((terminal): BackgroundTask[] => terminal.owner === "model" && terminal.runningCommand ? [{
    kind: "terminal", id: terminal.name, key: `${terminal.generation}:${terminal.runningCommand.id}`,
    name: terminal.name, generation: terminal.generation, commandId: terminal.runningCommand.id,
    startedAt: terminal.runningCommand.startedAt,
    displayName: taskName({ kind: "terminal", name: terminal.label || terminal.name, command: terminal.runningCommand.text }),
  }] : []);
  return [...kernel, ...terminalTasks].sort((a, b) => a.startedAt - b.startedAt);
}
