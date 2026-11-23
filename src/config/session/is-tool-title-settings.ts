import type { ToolTitleSettings } from "./session-options.ts";

export function isToolTitleSettings(value: unknown): value is ToolTitleSettings {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === 1 && Object.hasOwn(value, "enabled")
    && typeof (value as Record<string, unknown>).enabled === "boolean";
}
