import { FORBIDDEN } from "../config-constants.ts";
import { invalid } from "../reject-invalid-config.ts";

export function parts(key: string): string[] {
  const split = key.split(".");
  if (split.some((part) => !part || FORBIDDEN.includes(part))) invalid(`Invalid config key ${JSON.stringify(key)}.`);
  return split;
}
