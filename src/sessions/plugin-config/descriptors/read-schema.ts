import { existsSync, readFileSync } from "node:fs";
import type { PluginConfigContext, PluginConfigSection } from "../config-types.ts";
import { schemaPath } from "./resolve-schema-path.ts";

export function readSchema(ctx: PluginConfigContext, provider: string): { file: string; sections: PluginConfigSection[] } | undefined {
  const path = schemaPath(ctx, provider);
  if (!existsSync(path)) return undefined;
  const stored = JSON.parse(readFileSync(path, "utf8")) as { file: string; sections: PluginConfigSection[] };
  return { file: stored.file, sections: stored.sections ?? [] };
}
