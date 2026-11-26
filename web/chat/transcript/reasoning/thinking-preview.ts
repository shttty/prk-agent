const firstLine = (text: string) => (text.split("\n").find((line) => line.trim()) || "").replaceAll("**", "").trim();
/**
 * One-line preview of a thinking block. While it streams: the first line of the latest completed paragraph
 * (paragraphs end at a blank line), so the preview changes once per paragraph instead of per token. Once settled:
 * the first line of the whole text. Markdown bold markers are dropped.
 */
export function thinkingPreview(text: unknown, streaming: boolean): string {
  const value = typeof text === "string" ? text.replaceAll("\r\n", "\n") : "";
  if (!streaming) return firstLine(value);
  const paragraphs = value.split(/\n[ \t]*\n/);
  // The last piece is still being written; a completed one precedes it.
  for (let index = paragraphs.length - 2; index >= 0; index--) {
    const line = firstLine(paragraphs[index] ?? "");
    if (line) return line;
  }
  return "";
}
