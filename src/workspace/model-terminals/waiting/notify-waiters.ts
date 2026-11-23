import type { Command } from "../model-terminals-types.ts";

export function wake(command: Command): void { for (const listener of [...command.waiters]) listener(); }
