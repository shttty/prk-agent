import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { fieldText } from "../fields/is-field-text.ts";

export const tags = (value: unknown, limits: LimitsOptions) => Array.isArray(value) && value.length <= limits.tagsMax
  && value.every((tag) => fieldText(tag, limits.tagChars));
