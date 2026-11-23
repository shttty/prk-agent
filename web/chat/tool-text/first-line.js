import { asText } from "./as-text.js";
export function firstLine(text) {
  const line = asText(text).split("\n").map((value) => value.trim()).find(Boolean) || "";
  return line.length > 160 ? `${line.slice(0, 160)}…` : line;
}
