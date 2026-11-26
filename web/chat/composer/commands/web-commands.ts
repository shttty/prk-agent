import type { ComposerCommand, NativeCommand } from "../composer-types.ts";
import { COMMAND_HELP } from "./command-text.ts";
import { dynamicHelp } from "./dynamic-help.ts";
/**
 * Commands the Web composer lists in "/", in catalog order: advertised Web builtins
 * plus loaded skills, prompt templates and extension commands. Never gated on session state.
 */
export function webCommands(commands: readonly NativeCommand[]): ComposerCommand[] {
  return commands.flatMap((command): ComposerCommand[] => {
    if (command.hidden === true) return [];
    if (command.source === "skill" && command.availability?.enabled === false) return [];
    const builtin = command.source === "builtin";
    const copy = builtin ? COMMAND_HELP[command.name] : null;
    if (builtin && !copy) return [];
    const description = typeof command.description === "string" ? command.description.trim() : "";
    const summary = copy?.summary || description;
    const help = copy ? copy.help : dynamicHelp(command, description);
    return [{ ...command, summary, help }];
  });
}
