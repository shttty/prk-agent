import type { ComposerCommand } from "../composer-types.ts";

export function commandCandidates(commands: readonly ComposerCommand[], draft: string): ComposerCommand[] {
  const normalized = draft.trimStart();
  if (!/^\/\S*$/.test(normalized)) return [];
  const prefix = "/";
  const query = normalized.slice(1).toLowerCase();
  return commands
    .filter((command) => command.name.toLowerCase().includes(query))
    .map((command) => ({ ...command, prefix }));
}
