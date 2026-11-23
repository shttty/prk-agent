import type { PluginConfigContext, PluginConfigSection } from "../config-types.ts";
import { SECRET_NAME } from "../config-constants.ts";
import { leaves } from "./list-leaf-keys.ts";

export function secretKeys(ctx: PluginConfigContext, sections: PluginConfigSection[], values: Record<string, unknown>): string[] {
  const keys = new Set(sections.flatMap((section) => section.fields.filter((field) => field.secret === true || SECRET_NAME.test(field.key.split(".").at(-1)!)).map((field) => field.key)));
  for (const key of leaves(values)) if (SECRET_NAME.test(key.split(".").at(-1)!)) keys.add(key);
  return [...keys];
}
