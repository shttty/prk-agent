import "./ansi.css";
import { STYLES } from "./styled-chunk.js";
import { foreground } from "./styled-chunk.js";
export function styledChunk(chunk, content, key) {
  // anser swaps fg/bg for inverse; take the original foreground back.
  const { token, tone, color } = foreground(chunk.isInverted ? chunk.bg : chunk.fg);
  const decorations = chunk.decorations.filter((name) => STYLES.has(name)).join(" ");
  if (!token && !color && !decorations) return content;
  return <span key={key} className="pi-ansi" data-ansi-token={token} data-ansi-tone={tone} data-ansi-color={color} data-ansi-style={decorations || undefined}>{content}</span>;
}
