export function sourceLabel(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = "source" in value && typeof value.source === "string" ? value.source : undefined;
  const path = "path" in value && typeof value.path === "string" ? value.path.split(/[\\/]/u).at(-1) : undefined;
  if (source && path) return `${source}:${path}`;
  return source ?? path;
}
