import { chunks } from "./chunks.ts";
import type { ReactNode } from "react";
import { styledChunk } from "./styled-chunk.tsx";
/** Parse once before splitting rows so SGR state survives newlines and tool-output folds. */
export function ansiLines(text: unknown): ReactNode[][] {
  const rows: ReactNode[][] = [[]];
  for (const chunk of chunks(text)) {
    for (const [index, part] of chunk.content.split("\n").entries()) {
      if (index) rows.push([]);
      const row = rows[rows.length - 1];
      if (part && row) row.push(styledChunk(chunk, part, row.length));
    }
  }
  return rows;
}
