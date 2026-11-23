export function metadataKeys(data: Record<string, unknown>, allowed: readonly string[], required?: readonly string[]): boolean {
  const keys = Object.keys(data);
  return keys.every((key) => allowed.includes(key)) && (required === undefined || required.every((key) => keys.includes(key)));
}
