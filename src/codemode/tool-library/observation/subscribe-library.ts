import type { ToolLibraryContext } from "../library-state.ts";

export function subscribe(ctx: ToolLibraryContext, listener: () => void): () => void { ctx.listeners.add(listener); return () => ctx.listeners.delete(listener); }
