import type { ConfigField, ConfigValues } from "../capability-types.ts";
import { getPath } from "./get-path.ts";
export function changedKeys(fields: ConfigField[], values: ConfigValues, draft: ConfigValues) {
  return fields.filter((field) => JSON.stringify(getPath(values, field.key)) !== JSON.stringify(getPath(draft, field.key))).map((field) => field.key);
}
