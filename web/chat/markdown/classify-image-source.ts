export type ImageSource = { kind: "external" | "target"; value: string };

export function classifyImageSource(source: unknown): ImageSource | null {
  if (typeof source !== "string" || !source.trim() || /[\\\p{Cc}]/u.test(source)) return null;
  if (/^https?:\/\/[^/?#]/i.test(source)) {
    try { return { kind: "external", value: new URL(source).href }; }
    catch { return null; }
  }
  let path = source;
  try { path = decodeURIComponent(source); } catch { /* A literal percent sign is valid in a target path. */ }
  if (path.startsWith("//") || /^[a-z][a-z\d+.-]*:/i.test(path) || /[\\\p{Cc}]/u.test(path)
    || (path.startsWith("~") && !path.startsWith("~/"))) return null;
  return { kind: "target", value: path };
}
