export function textLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((part) => {
    if (typeof part === "object" && part !== null && "type" in part && part.type === "text" && "text" in part && typeof part.text === "string") return [part.text];
    return [];
  });
}
