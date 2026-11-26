import { safeText } from "../../workbench/payloads/safe-text.js";
import { chunks } from "./chunks.ts";
import { styledChunk } from "./styled-chunk.tsx";
/** ANSI text uses existing semantic web tones and attributes, never terminal backgrounds. */
export function AnsiText({ text }: { text: unknown }) {
  const value = safeText(text);
  if (!/[\u001B\u009B]/.test(value)) return value;
  return chunks(value).map((chunk, index) => styledChunk(chunk, chunk.content, index));
}
