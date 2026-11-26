/** The first paragraph of a tool description on one line: what stubs and tool lists show; later paragraphs are for describe(name). */
export function summarizeDescription(description: string): string {
  return (description.trim().split(/\r?\n[ \t]*\r?\n/u, 1)[0] ?? "").replace(/\s+/gu, " ").trim();
}
