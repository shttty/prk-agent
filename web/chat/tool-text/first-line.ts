import { asText } from "./as-text.ts";
export function firstLine(text: unknown) {
  const line = asText(text).split("\n").map((value) => value.trim()).find(Boolean) || "";
  return line.length > 160 ? `${line.slice(0, 160)}…` : line;
}
