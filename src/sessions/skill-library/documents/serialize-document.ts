// JSON strings/values are YAML-safe, including colons, quotes, hashes and newlines.
export function document(frontmatter: Record<string, unknown>, body: string): string {
  return `---\n${Object.entries(frontmatter).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join("\n")}\n---\n\n${body.trim()}\n`;
}
