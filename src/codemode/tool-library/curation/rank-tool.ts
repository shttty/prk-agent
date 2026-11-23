import type { ToolLibraryContext } from "../library-state.ts";
import type { StoredTool } from "../library-types.ts";

export function score(ctx: ToolLibraryContext, a: StoredTool, b: StoredTool): number {
  return a.sessions.length - b.sessions.length || (a.lastUsedAt ? Date.parse(a.lastUsedAt) : 0) - (b.lastUsedAt ? Date.parse(b.lastUsedAt) : 0);
}
