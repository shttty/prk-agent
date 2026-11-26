/** A string parameter of a dock panel (`params` is untyped dockview state), or null. */
export function paramString(params: Record<string, unknown> | undefined, key: string): string | null {
  const value = params?.[key];
  return typeof value === "string" ? value : null;
}
