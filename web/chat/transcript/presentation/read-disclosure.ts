export function readDisclosure(openedTools: readonly string[] = [], key: string, { defaultOpen = false, fallbackId }: { defaultOpen?: boolean; fallbackId?: string } = {}): boolean {
  if (openedTools.includes(`!${key}`)) return false;
  if (openedTools.includes(key) || (fallbackId && openedTools.some((value) => !value.startsWith("!") && value.endsWith(`:${fallbackId}`)))) return true;
  return defaultOpen;
}
