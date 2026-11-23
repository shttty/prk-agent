import type { PluginConfigContext, PluginConfigView } from "./config-types.ts";
import { readSchema } from "./descriptors/read-schema.ts";
import { readValues } from "./values/read-values.ts";
import { secretKeys } from "./masking/find-secret-keys.ts";
import { getPath } from "./values/get-key.ts";
import { setPath } from "./values/set-key.ts";
import { MASK } from "./config-constants.ts";

export function get(ctx: PluginConfigContext, provider: string): PluginConfigView {
  const schema = readSchema(ctx, provider);
  if (!schema) return { provider, configured: false, sections: [], values: {}, exists: false, secrets: [] };
  const { values, exists } = readValues(ctx, schema.file);
  const secrets = secretKeys(ctx, schema.sections, values);
  const masked = structuredClone(values);
  for (const key of secrets) {
    const value = getPath(masked, key);
    if (typeof value === "string" && value) setPath(masked, key, MASK);
  }
  return { provider, configured: true, file: schema.file, sections: schema.sections, values: masked, exists, secrets };
}
