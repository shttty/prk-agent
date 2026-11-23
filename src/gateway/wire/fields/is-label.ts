import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { fieldText } from "./is-field-text.ts";

export const label = (value: unknown, limits: LimitsOptions) => fieldText(value, limits.labelChars);
