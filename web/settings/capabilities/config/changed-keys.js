import { getPath } from "./get-path.js";
export function changedKeys(fields, values, draft) {
  return fields.filter((field) => JSON.stringify(getPath(values, field.key)) !== JSON.stringify(getPath(draft, field.key))).map((field) => field.key);
}
