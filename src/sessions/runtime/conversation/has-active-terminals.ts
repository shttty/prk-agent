import type { RuntimeContext } from "../runtime-state.ts";

export function getTerminalActive(ctx: RuntimeContext): boolean { return Boolean(ctx.modelTerminals?.hasRunning() || ctx.terminalEvents?.pending); }
