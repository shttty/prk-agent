export function packageSource(entry: unknown): string | undefined {
  if (typeof entry === "string") return entry;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return undefined;
  const source = (entry as { source?: unknown }).source;
  return typeof source === "string" ? source : undefined;
}
