import { createHash } from "node:crypto";
import type { Options, ToolContentPreview } from "../content-types.ts";

export function preview(value: unknown, text: string, options: Options, always = false): ToolContentPreview | undefined {
  const bytes = Buffer.byteLength(text, "utf8");
  const rows = text.split("\n");
  const lines = rows.length;
  // Compact JSON also accounts for non-display details, structured content and images.
  const serialized = JSON.stringify(value) ?? "null";
  if (!always && bytes <= options.maxBytes && lines <= options.maxLines
    && Buffer.byteLength(serialized, "utf8") <= options.maxBytes) return undefined;
  const beginning = rows.slice(0, Math.min(options.maxLines, 20)).join("\n");
  const maxBytes = Math.min(options.maxBytes, 2048);
  let bounded = "";
  let used = 0;
  for (const character of beginning) {
    const size = Buffer.byteLength(character, "utf8");
    if (used + size > maxBytes) break;
    bounded += character;
    used += size;
  }
  return { preview: bounded, bytes, lines, version: createHash("sha256").update(serialized).digest("hex") };
}
