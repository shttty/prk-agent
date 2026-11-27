/** Paths from `npm pack --dry-run --json`: npm 11 prints an array of one entry, npm 12 an object keyed by package name. Undefined for any other shape. */
export function readPackedFiles(output: string): string[] | undefined {
  let parsed: unknown;
  try { parsed = JSON.parse(output); } catch { return undefined; }
  const entries: unknown[] = Array.isArray(parsed) ? parsed : parsed !== null && typeof parsed === "object" ? Object.values(parsed) : [];
  if (entries.length !== 1) return undefined;
  const files = (entries[0] as { files?: unknown } | null)?.files;
  if (!Array.isArray(files)) return undefined;
  const paths = files.map((file: { path?: unknown } | null) => file?.path);
  return paths.every((path) => typeof path === "string") ? paths : undefined;
}
