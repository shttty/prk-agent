import type { PluginConfigContext } from "../config-types.ts";
import { join } from "node:path";
import { invalid } from "../reject-invalid-config.ts";

export function schemaPath(ctx: PluginConfigContext, provider: string): string {
  if (!provider.trim() || provider.length > 200) invalid("Provider name is required.");
  return join(ctx.directory, `${encodeURIComponent(provider)}.json`);
}
