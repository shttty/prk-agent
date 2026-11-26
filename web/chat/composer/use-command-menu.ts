import { useMemo } from "react";
import { webCommands } from "./commands/web-commands.ts";
import { commandRedirect } from "./commands/command-redirect.ts";
import { commandCandidates } from "./commands/command-candidates.ts";
import type { NativeCommand } from "./composer-types.ts";
export function useCommandMenu({ composerText, commands, popupDismissed }: { composerText: string; commands: NativeCommand[] | undefined; popupDismissed: boolean }) {
  const normalizedComposerText = composerText.trimStart();
  const allCommands = useMemo(() => commands || [], [commands]);
  const visibleCommands = useMemo(() => webCommands(allCommands), [allCommands]);
  const candidateOptions = useMemo(() => commandCandidates(visibleCommands, composerText), [visibleCommands, composerText]);
  const commandToken = /^\/([^\s]*)/.exec(normalizedComposerText)?.[1] || "";
  const activeCommand = visibleCommands.find((command) => command.name === commandToken) || null;
  const commandElsewhere = commandToken && !activeCommand ? commandRedirect(allCommands, commandToken) : null;
  const commandMenuOpen = !popupDismissed && candidateOptions.length > 0 && normalizedComposerText.startsWith("/");
  return { normalizedComposerText, candidateOptions, activeCommand, commandElsewhere, commandMenuOpen };
}
