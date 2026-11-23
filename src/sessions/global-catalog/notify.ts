import type { CatalogContext } from "./catalog-types.ts";
import { recordPluginError } from "./record-plugin-error.ts";

export function notify(ctx: CatalogContext, message: string, type?: "info" | "warning" | "error", source?: string): void {
  if (type === "error") recordPluginError(ctx, source, message, "Unattributed plugin notification");
  if (type !== "warning") return;
  if (source && ctx.input.pluginWarnings) {
    const warnings = ctx.input.pluginWarnings.get(source) ?? new Set<string>();
    if (warnings.has(message)) return;
    warnings.add(message);
    ctx.input.pluginWarnings.set(source, warnings);
  }
  console.warn(`[plugin discovery] warning ${source ?? "(unattributed)"}: ${message.replace(/\r?\n/g, "\\n")}`);
}
