import { WireError } from "../../../gateway/wire/create-error.ts";
import { KEY_BYTES } from "../model-terminals-constants.ts";

export function keyBytes(keys: string): string {
  if (!keys.trim()) throw new WireError("INVALID_REQUEST", "keys must name at least one key.");
  return keys.trim().split(/\s+/u).map((key) => {
    if (Object.hasOwn(KEY_BYTES, key)) return KEY_BYTES[key]!;
    if (/^C-[a-z@\[\]\\^_]$/iu.test(key)) return String.fromCharCode(key.charCodeAt(2) & 31);
    if ([...key].length === 1) return key;
    throw new WireError("INVALID_REQUEST", `Unsupported terminal key: ${key}.`);
  }).join("");
}
