import { chunks } from "./chunks.js";
import { styledChunk } from "./styled-chunk.jsx";
/** Parse once before splitting rows so SGR state survives newlines and tool-output folds. */
export function ansiLines(text) {
  const rows = [[]];
  for (const chunk of chunks(text)) {
    for (const [index, part] of chunk.content.split("\n").entries()) {
      if (index) rows.push([]);
      if (part) rows.at(-1).push(styledChunk(chunk, part, rows.at(-1).length));
    }
  }
  return rows;
}
