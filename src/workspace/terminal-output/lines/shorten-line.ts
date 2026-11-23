import { Buffer } from "node:buffer";
import type { TerminalOptions } from "../../../config/terminal/terminal-options.ts";
import type { Piece } from "../terminal-output-types.ts";
import { outputOmission } from "../format-output-omission.ts";

export function shortenLine(line: string, pattern: RegExp | undefined, options: TerminalOptions, offset: number | undefined, commandId: string | undefined): Piece[] {
  if (line.length <= options.longLineThresholdChars) return [{ text: line, offset, end: offset === undefined ? undefined : offset + Buffer.byteLength(line) }];
  const ranges: [number, number][] = [];
  const include = (from: number, to: number): void => {
    let start = Math.max(0, from), end = Math.min(line.length, to);
    // Config counts UTF-16 units, but a retained boundary must not split a code point.
    if (start > 0 && /[\uDC00-\uDFFF]/u.test(line[start]!)) start--;
    if (end < line.length && /[\uDC00-\uDFFF]/u.test(line[end]!)) end++;
    const previous = ranges.at(-1);
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else ranges.push([start, end]);
  };
  include(0, options.longLineHeadChars);
  if (pattern) {
    pattern.lastIndex = 0;
    for (const match of line.matchAll(pattern)) {
      if (match[0].length) include(match.index - options.longLineContextChars, match.index + match[0].length + options.longLineContextChars);
    }
  }
  include(line.length - options.longLineTailChars, line.length);
  const pieces: Piece[] = [];
  let cursor = 0, bytes = offset;
  for (const [start, end] of ranges) {
    if (start > cursor) {
      const next = bytes === undefined ? undefined : bytes + Buffer.byteLength(line.slice(cursor, start));
      pieces.push({ text: outputOmission(start - cursor, bytes, commandId), offset: bytes, end: next, hidden: start - cursor });
      bytes = next;
    }
    const text = line.slice(start, end);
    const piece: Piece = { text, offset: bytes, end: bytes === undefined ? undefined : bytes + Buffer.byteLength(text) };
    pieces.push(piece);
    bytes = piece.end;
    cursor = end;
  }
  return pieces;
}
