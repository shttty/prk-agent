export type HighlightQuery = { name?: string; filename?: string };
/** One highlighted run: the text and its token class ("" for plain text). */
export type Segment = [text: string, className: string];
export type HighlightedLines = Segment[][];
/** A tool result preview whose full text loads on demand. */
export type DeferredContent = { bytes: number; lines: number; version: string | number };
