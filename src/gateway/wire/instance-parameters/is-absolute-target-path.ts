import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { isAbsoluteCwd } from "../../../config/execution-target/is-absolute-cwd.ts";
import { fieldText } from "../fields/is-field-text.ts";

/** Browsing uses target absolute POSIX paths. */
export function validAbsolutePath(value: unknown, limits: LimitsOptions): boolean {
  return fieldText(value, limits.cwdChars) && isAbsoluteCwd(value);
}
