import { LOGIN_PROFILES } from "./login-profiles.ts";
import { withSsh } from "./with-ssh.ts";

// Both terminal owners use the same profiles, user hooks and shell markers.
export function createBashRc(modelSettings = ""): string {
  return withSsh(LOGIN_PROFILES + modelSettings + String.raw`
unset __prk_rcfile
shopt -s huponexit
__prk_debug_declaration=$(trap -p DEBUG)
trap - DEBUG
export COLORTERM=truecolor
# The PTY is PRK's xterm.js, whatever terminal started the Gateway or the target daemon (a local daemon inherits the
# Gateway's environment): drop inherited emulator and multiplexer identity so programs probe this terminal instead of
# assuming another one (tmux refusing to nest, tmux passthrough or kitty-only image paths).
unset TERM_PROGRAM_VERSION TMUX TMUX_PANE STY KITTY_WINDOW_ID KITTY_PID KITTY_LISTEN_ON WEZTERM_PANE WEZTERM_UNIX_SOCKET \
  ITERM_SESSION_ID LC_TERMINAL LC_TERMINAL_VERSION VTE_VERSION KONSOLE_VERSION KONSOLE_DBUS_SESSION WT_SESSION \
  ALACRITTY_WINDOW_ID GHOSTTY_RESOURCES_DIR TERMINAL_EMULATOR
export TERM_PROGRAM=prk
__prk_user_debug=''
if [[ -n $__prk_debug_declaration ]]; then
  __prk_debug_declaration=${"$"}{__prk_debug_declaration%" DEBUG"}
  eval "__prk_user_debug=${"$"}{__prk_debug_declaration#"trap -- "}"
fi
unset __prk_debug_declaration
__prk_prompt_commands=()
__prk_pc_declaration=$(declare -p PROMPT_COMMAND 2>/dev/null || true)
if [[ $__prk_pc_declaration == "declare -a"* ]]; then
  __prk_prompt_commands=("${"$"}{PROMPT_COMMAND[@]}")
elif [[ -n ${"$"}{PROMPT_COMMAND-} ]]; then
  __prk_prompt_commands=("$PROMPT_COMMAND")
fi
unset __prk_pc_declaration
__prk_active=0
__prk_in_prompt=1
__prk_prompt_begin() {
  local __prk_status=$?
  __prk_in_prompt=1
  if (( __prk_active )); then printf '\033]133;D;%s\007' "$__prk_status"; fi
  __prk_active=0
  return "$__prk_status"
}
__prk_prompt_end() {
  local __prk_status=$?
  printf '\033]7;file://localhost%s\007' "$PWD"
  printf '\033]133;A\007'
  if [[ ${"$"}{PS1-} != *'\e]133;B\a'* && ${"$"}{PS1-} != *$'\033]133;B\007'* ]]; then
    PS1+='\[\e]133;B\a\]'
  fi
  __prk_in_prompt=0
  return "$__prk_status"
}
__prk_preexec() {
  if (( ! __prk_in_prompt && ! __prk_active )) &&
      [[ $BASH_COMMAND != __prk_prompt_begin && ${"$"}{FUNCNAME[1]-} != __prk_prompt_* ]]; then
    __prk_active=1
    printf '\033]133;C\007'
  fi
  return "$1"
}
# Native PROMPT_COMMAND evaluation preserves string/array status propagation
# and global shell effects; the final hook also follows dynamic PS1 changes.
PROMPT_COMMAND=(__prk_prompt_begin "${"$"}{__prk_prompt_commands[@]}" __prk_prompt_end)
unset __prk_prompt_commands
# Restore the incoming status before the user's DEBUG body, in trap context.
# Install last so integration setup itself never starts a tracked command.
trap '__prk_preexec "$?"; '"$__prk_user_debug" DEBUG
`);
}
