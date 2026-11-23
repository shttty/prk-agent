import { taskName } from "../../../shared/background-task-name.js";

export function backgroundTasks(cells, terminals) {
  return [
    ...cells.map((cell) => ({ ...cell, kind: "kernel", id: cell.cellId, key: `${cell.kernelId}:${cell.cellId}`, displayName: cell.taskName })),
    ...(terminals || []).filter((terminal) => terminal.owner === "model" && terminal.runningCommand).map((terminal) => ({
      kind: "terminal", id: terminal.name, key: `${terminal.generation}:${terminal.runningCommand.id}`,
      name: terminal.name, generation: terminal.generation, commandId: terminal.runningCommand.id,
      startedAt: terminal.runningCommand.startedAt,
      displayName: taskName({ kind: "terminal", name: terminal.label || terminal.name, command: terminal.runningCommand.text }),
    })),
  ].sort((a, b) => a.startedAt - b.startedAt);
}
