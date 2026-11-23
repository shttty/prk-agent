import { COMMAND_HELP } from "./command-text.js";
import { dynamicHelp } from "./dynamic-help.js";
/**
 * Commands the Web composer lists in "/", in catalog order: advertised Web builtins
 * plus loaded skills, prompt templates and extension commands. Never gated on session state.
 */
export function webCommands(commands) {
  return (Array.isArray(commands) ? commands : []).flatMap((command) => {
    if (!command || typeof command.name !== "string" || command.hidden === true) return [];
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
