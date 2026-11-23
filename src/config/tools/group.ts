export function group(path: string, supplied: unknown, defaults: Record<string, unknown>): Record<string, unknown> {
  if (supplied === undefined) return structuredClone(defaults);
  if (!supplied || typeof supplied !== "object" || Array.isArray(supplied)) throw new Error(`Invalid PRK configuration: ${path} must be an object.`);
  const result = structuredClone(defaults);
  for (const [key, option] of Object.entries(supplied)) {
    if (!Object.hasOwn(defaults, key)) throw new Error(`Invalid PRK configuration: unsupported ${path}.${key}.`);
    if (typeof defaults[key] === "object") result[key] = group(`${path}.${key}`, option, defaults[key] as Record<string, unknown>);
    else {
      if (typeof option !== "number" || !Number.isSafeInteger(option) || option < 1) throw new Error(`Invalid PRK configuration: ${path}.${key} must be a positive safe integer.`);
      result[key] = option;
    }
  }
  return result;
}
