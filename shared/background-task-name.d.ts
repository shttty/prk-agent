export function taskName(task: { kind: "kernel"; title?: string; code: string } | { kind: "terminal"; name: string; command: string }): string;
