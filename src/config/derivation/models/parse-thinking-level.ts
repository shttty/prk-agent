import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { THINKING_LEVELS } from "./derivation-constants.ts";
import { invalid } from "../reject-invalid-config.ts";

export function parseThinkingLevel(value: unknown, field: string): ThinkingLevel {
  if (typeof value !== "string" || THINKING_LEVELS[value as ThinkingLevel] !== true) {
    invalid(`${field} must be one of off, minimal, low, medium, high, xhigh, max`);
  }
  return value as ThinkingLevel;
}
