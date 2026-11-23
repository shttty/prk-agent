export function commandLine(text: string): string {
  const line = /(?:^|[\r\n])[^\S\r\n]*([^\s\r\n][^\r\n]*)/u.exec(text)?.[1].trimEnd() ?? "";
  return line.length <= 160 ? line : `${line.slice(0, 159).replace(/[\uD800-\uDBFF]$/u, "")}…`;
}
