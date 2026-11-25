export function readDisclosure(openedTools = [], key, fallbackId) {
  if (openedTools.includes(`!${key}`)) return false;
  if (openedTools.includes(key) || (fallbackId && openedTools.some((value) => !value.startsWith("!") && value.endsWith(`:${fallbackId}`)))) return true;
  return undefined;
}
