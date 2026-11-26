import type { LightSettingChanges } from "./native-action-types.ts";

const FIELDS = ["model", "thinkingLevel", "toolMode", "delegation"] as const;

/**
 * The light settings an action's data or arguments carry. The Gateway validated the values (model ids, thinking
 * levels, tool modes, delegation levels) when it applied them, so a string is taken as sent.
 */
export function lightSettingChanges(values: Record<string, unknown>): LightSettingChanges {
  const changes: Record<string, string> = {};
  for (const field of FIELDS) {
    const value = values[field];
    if (typeof value === "string") changes[field] = value;
  }
  return changes;
}
