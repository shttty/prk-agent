/** A written file as an all-added Pi diff, so one renderer shows both tools. */
export function writeDiff(content: string): string {
  const lines = content.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const width = String(lines.length).length;
  return lines.map((text, index) => `+${String(index + 1).padStart(width)} ${text}`).join("\n");
}
