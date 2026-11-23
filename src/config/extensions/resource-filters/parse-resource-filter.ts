import type { ExtensionResourceFilter } from "../extensions-options.ts";

export function parseResourceFilter(path: string, value: unknown): ExtensionResourceFilter {
  if (value === undefined) return { packages: [], tools: [] };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid PRK configuration: ${path} must be an object.`);
  }
  const document = value as Record<string, unknown>;
  for (const key of Object.keys(document)) {
    if (key !== "packages" && key !== "tools") {
      throw new Error(`Invalid PRK configuration: unsupported ${path}.${key}.`);
    }
  }
  const list = (key: "packages" | "tools"): readonly string[] => {
    const supplied = document[key];
    if (supplied === undefined) return [];
    if (!Array.isArray(supplied) || supplied.some((entry) => typeof entry !== "string" || entry.length === 0 || /\p{Cc}/u.test(entry))) {
      throw new Error(`Invalid PRK configuration: ${path}.${key} must be an array of non-empty strings without control characters.`);
    }
    return [...supplied] as string[];
  };
  return { packages: list("packages"), tools: list("tools") };
}
