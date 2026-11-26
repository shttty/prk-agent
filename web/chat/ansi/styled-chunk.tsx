import "./ansi.css";
import type { AnserJsonEntry } from "anser";
import { STYLES } from "./styled-chunk.ts";
import { foreground } from "./styled-chunk.ts";
// anser sets `isInverted` at runtime but leaves it out of its declarations.
export type AnsiChunk = AnserJsonEntry & { isInverted?: boolean };

export function styledChunk(chunk: AnsiChunk, content: string, key: number) {
  // anser swaps fg/bg for inverse; take the original foreground back.
  const { token, tone, color } = foreground(chunk.isInverted ? chunk.bg : chunk.fg);
  const decorations = chunk.decorations.filter((name) => STYLES.has(name)).join(" ");
  if (!token && !color && !decorations) return content;
  return <span key={key} className="pi-ansi" data-ansi-token={token} data-ansi-tone={tone} data-ansi-color={color} data-ansi-style={decorations || undefined}>{content}</span>;
}
