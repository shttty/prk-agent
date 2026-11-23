
export function limitBytes(text) {
  const match = /^(\d+)([KMGTPE])?$/u.exec(String(text));
  if (!match) return null;
  return Number(match[1]) * 1024 ** (match[2] ? "KMGTPE".indexOf(match[2]) + 1 : 0);
}
