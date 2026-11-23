import { useMemo } from "react";
import { webCommands } from "./commands/web-commands.js";
import { commandRedirect } from "./commands/command-redirect.js";
import { commandCandidates } from "./commands/command-candidates.js";
export function useCommandMenu(ctx) {
  const { composerText, commands, popupDismissed } = ctx;
  const normalizedComposerText = composerText.trimStart();
  const allCommands = useMemo(() => commands || [], [commands]);
  const visibleCommands = useMemo(() => webCommands(allCommands), [allCommands]);
  const candidateOptions = useMemo(() => commandCandidates(visibleCommands, composerText), [visibleCommands, composerText]);
  const commandToken = normalizedComposerText.match(/^\/([^\s]*)/)?.[1] || "";
  const activeCommand = visibleCommands.find((command) => command.name === commandToken) || null;
  const commandElsewhere = commandToken && !activeCommand ? commandRedirect(allCommands, commandToken) : null;
  const commandMenuOpen = !popupDismissed && candidateOptions.length > 0 && normalizedComposerText.startsWith("/");
  return { normalizedComposerText, candidateOptions, activeCommand, commandElsewhere, commandMenuOpen };
}
