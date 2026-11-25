export function wakesSleepingSession(action: string): boolean {
  return ["compact", "settings", "tree", "tree-label"].includes(action);
}
