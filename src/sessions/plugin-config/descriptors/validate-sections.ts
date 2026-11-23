import type { PluginConfigSection } from "../config-types.ts";
import { FIELD_TYPES } from "./config-schema.ts";
import { parts } from "../values/parse-key-path.ts";
import { invalid } from "../reject-invalid-config.ts";

export function validSections(sections: PluginConfigSection[]): PluginConfigSection[] {
  const seen = new Set<string>();
  for (const section of sections) for (const field of section.fields) {
    parts(field.key);
    if (seen.has(field.key)) invalid(`Config key ${JSON.stringify(field.key)} appears twice.`);
    seen.add(field.key);
    if (!(FIELD_TYPES as readonly string[]).includes(field.type)) invalid(`Config field ${field.key} has an unsupported type.`);
    if (field.type === "select" && !field.options?.length) invalid(`Select field ${field.key} needs options.`);
  }
  return sections;
}
