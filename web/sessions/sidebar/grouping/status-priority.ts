const PRIORITY: Record<string, number> = { blocked: 5, stopped: 4, running: 3, compacting: 3, starting: 3, cancel_requested: 3, background: 2, done: 1 };

export const statusPriority = (state: string | undefined): number => (state ? PRIORITY[state] : undefined) ?? 0;
