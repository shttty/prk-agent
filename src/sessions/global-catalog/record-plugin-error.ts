import type { CatalogContext } from "./catalog-types.ts";

export function recordPluginError(ctx: CatalogContext, source: string | undefined, reason: string, fallback: string): void {
  if (!source) {
    ctx.failures.push(`${fallback}: ${reason}`);
    return;
  }
  const previous = ctx.pluginFailures.get(source);
  ctx.pluginFailures.set(source, previous ? `${previous}\n${reason}` : reason);
  console.error(`[plugin discovery] unavailable ${source}: ${reason.replace(/\r?\n/g, "\\n")}`);
}
