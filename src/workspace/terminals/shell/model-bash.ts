import { createBashCommand } from "./create-bash-command.ts";
import { createBashRc } from "./create-bash-rc.ts";

// The typed configuration is quoted here; HOME expansion belongs to each target.
export function createModelBashCommand(historyFile: string): string[] {
  const quote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;
  const path = historyFile.startsWith("~") ? `"$HOME"${quote(historyFile.slice(1))}` : quote(historyFile);
  return createBashCommand(createBashRc(`
export DEBIAN_FRONTEND=noninteractive PIP_NO_INPUT=1 PYTHONUNBUFFERED=1 GIT_TERMINAL_PROMPT=0
HISTFILE=${path}
shopt -s histappend
# PROMPT_COMMAND runs after Bash reads history; --rcfile runs before it.
if [[ \${__prk_rcfile-} != 1 ]]; then history -c; history -r; fi
PROMPT_COMMAND=("\${PROMPT_COMMAND[@]}" 'history -a')
set +H
bind 'set enable-bracketed-paste on' 2>/dev/null
`));
}
