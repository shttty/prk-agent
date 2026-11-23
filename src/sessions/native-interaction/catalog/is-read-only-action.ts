import { staticCommands } from "./command-metadata.ts";

const readOnlyActions: Record<string, true> = {
  ...Object.fromEntries(staticCommands.filter((command) => command.effect === "read" || command.effect === "presentation").map((command) => [command.name, true])),
  "reference-candidates": true,
  "reference-read": true,
  "tree-read": true,
  "tree-filter": true,
  "tree-fold": true,
  "tree-copy": true,
};

export function isReadOnlyAction(action: string): boolean {
  return readOnlyActions[action] === true;
}
