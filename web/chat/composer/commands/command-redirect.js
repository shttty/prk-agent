import { COMMAND_HELP } from "./command-text.js";
import { COMMAND_ELSEWHERE } from "./command-text.js";
import { SETTINGS_LOCATION } from "./command-text.js";
import { UNSUPPORTED_REASON } from "./command-text.js";
/** Explains a typed command that the menu does not list; null when the name is unknown. */
export function commandRedirect(commands, name) {
  if (!name || COMMAND_HELP[name]) return null;
  if (COMMAND_ELSEWHERE[name]) return COMMAND_ELSEWHERE[name];
  if (name === "settings") return SETTINGS_LOCATION;
  const command = (Array.isArray(commands) ? commands : []).find((item) => item?.name === name);
  if (!command) return null;
  if (command.availability?.enabled !== false || command.source !== "builtin") return null;
  return UNSUPPORTED_REASON[name] || `网页端不执行 /${name}。`;
}
