import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, renameSync } from "node:fs";
import { isAbsolute, normalize } from "node:path";
import type { PluginConfigContext, PluginConfigSection, PluginConfigView } from "../config-types.ts";
import { invalid } from "../reject-invalid-config.ts";
import { schemaPath } from "./resolve-schema-path.ts";
import { validSections } from "./validate-sections.ts";
import { get } from "../get.ts";

/** Store semantics (or only a file path: `sections` empty). Replaces the provider's previous semantics. */
export function set(ctx: PluginConfigContext, provider: string, file: string, sections: PluginConfigSection[] = []): PluginConfigView {
  if (!isAbsolute(file) || normalize(file) !== file) invalid("Config file must be a normalized absolute path on the Gateway host.");
  const path = schemaPath(ctx, provider);
  mkdirSync(ctx.directory, { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify({ provider, file, sections: validSections(sections), updatedAt: new Date().toISOString() }, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
  return get(ctx, provider);
}
