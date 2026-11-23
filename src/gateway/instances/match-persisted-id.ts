export function persistedId(entry: unknown, id: string): boolean {
  return Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
    && typeof (entry as { id?: unknown }).id === "string" && (entry as { id: string }).id.trim() === id;
}
