
export function referenceToken(value: string): string | null {
  const match = /(?:^|\s)@([^\s@]*)$/.exec(value);
  return match ? match[1] ?? null : null;
}
