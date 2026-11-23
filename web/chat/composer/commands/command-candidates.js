
export function commandCandidates(commands, draft) {
  const normalized = draft.trimStart();
  if (!/^\/\S*$/.test(normalized)) return [];
  const prefix = "/";
  const query = normalized.slice(1).toLowerCase();
  return commands
    .filter((command) => command.name.toLowerCase().includes(query))
    .map((command) => ({ ...command, prefix }));
}
