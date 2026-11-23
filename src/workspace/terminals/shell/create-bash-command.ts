// Login-shell exit uses Bash's job table and huponexit, including disown -h.
export function createBashCommand(rc: string): string[] {
  const quote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;
  const bootstrap = `unset PROMPT_COMMAND __prk_rcfile; source <(printf %s ${quote(rc)})` + String.raw`; eval -- "$(printf '%s\n' "${"$"}{PROMPT_COMMAND[@]}")"`;
  return ["/bin/bash", "--noprofile", "--norc", "-c",
    `export PROMPT_COMMAND=${quote(bootstrap)}; exec /bin/bash --login --noprofile -i`];
}
