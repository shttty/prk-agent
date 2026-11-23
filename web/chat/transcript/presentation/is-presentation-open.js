
export function isPresentationOpen(openedTools = [], key, toolCallId) {
  return openedTools.includes(key) || openedTools.some((value) => value.endsWith(`:${toolCallId}`));
}
