export function limitBytes(text: string): number | null {
  const match = /^(\d+)([KMGTPE])?$/u.exec(text);
  if (!match) return null;
  return Number(match[1]) * 1024 ** (match[2] ? "KMGTPE".indexOf(match[2]) + 1 : 0);
}
