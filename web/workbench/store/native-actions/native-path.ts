import type { StoreContext } from "../store-context-types.ts";

export function nativePath(ctx: StoreContext, name: string): string {
  return `${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/native`;
}
