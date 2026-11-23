import type { ExtensionFilter } from "./extensions-options.ts";
import { parseResourceFilter } from "./resource-filters/parse-resource-filter.ts";

export function parseExtensionFilters(value: unknown): ExtensionFilter {
  if (value === undefined) return { deny: { packages: [], tools: [] } };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid PRK configuration: extensions must be an object.");
  }
  const document = value as Record<string, unknown>;
  for (const key of Object.keys(document)) {
    if (!["deny", "allow"].includes(key)) {
      throw new Error(`Invalid PRK configuration: unsupported extensions.${key}.`);
    }
  }
  return {
    deny: parseResourceFilter("extensions.deny", document.deny),
    ...(document.allow === undefined ? {} : { allow: parseResourceFilter("extensions.allow", document.allow) }),
  };
}
