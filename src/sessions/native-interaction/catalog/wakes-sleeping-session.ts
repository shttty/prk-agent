export function wakesSleepingSession(action: string): boolean {
  return ["compact", "reload", "settings", "tree", "tree-label"].includes(action);
}
