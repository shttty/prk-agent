export function readDisclosure(openedTools = [], key, { defaultOpen = false, fallbackId } = {}) {
  if (openedTools.includes(`!${key}`)) return false;
  if (openedTools.includes(key) || (fallbackId && openedTools.some((value) => !value.startsWith("!") && value.endsWith(`:${fallbackId}`)))) return true;
  return defaultOpen;
}
