export function disabledBuiltins(failures?: ReadonlyMap<string, string>): string[] | undefined {
  if (!failures?.size) return;
  return [...failures.keys()].filter((source) => source.startsWith("builtin:")).map((source) => source.slice("builtin:".length));
}
