import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { fieldText } from "./is-field-text.ts";

export const routingIdentifier = (value: unknown, limits: LimitsOptions) => fieldText(value, limits.identityChars)
  && value !== "." && value !== ".." && !/[\\/]/.test(value);
