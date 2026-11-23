import type { UiContext } from "../../ui-types.ts";

export function queryTerminalColors(ctx: UiContext) { return Promise.reject(new Error("Extension UI capability unavailable: terminal colors require a terminal TUI.")); }
