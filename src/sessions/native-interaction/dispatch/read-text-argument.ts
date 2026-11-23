export function argumentText(args: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = args?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
