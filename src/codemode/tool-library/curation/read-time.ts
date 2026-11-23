import type { ToolLibraryContext } from "../library-state.ts";

export function time(ctx: ToolLibraryContext): string { return new Date(ctx.now()).toISOString(); }
