import type { NativeCommand } from "../composer-types.ts";
import { COMMAND_HELP } from "./command-text.ts";
import { COMMAND_ELSEWHERE } from "./command-text.ts";
import { SETTINGS_LOCATION } from "./command-text.ts";
import { UNSUPPORTED_REASON } from "./command-text.ts";
/** Explains a typed command that the menu does not list; null when the name is unknown. */
export function commandRedirect(commands: readonly NativeCommand[], name: string): string | null {
  if (!name || COMMAND_HELP[name]) return null;
  if (COMMAND_ELSEWHERE[name]) return COMMAND_ELSEWHERE[name];
  if (name === "settings") return SETTINGS_LOCATION;
  const command = commands.find((item) => item.name === name);
  if (!command) return null;
  if (command.availability?.enabled !== false || command.source !== "builtin") return null;
  return UNSUPPORTED_REASON[name] || `网页端不执行 /${name}。`;
}
