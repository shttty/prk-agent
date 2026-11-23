import { Buffer } from "node:buffer";
import { stripVTControlCharacters } from "node:util";
import type { TerminalOptions } from "../../config/terminal/terminal-options.ts";
import { searchPattern } from "./search/parse-search-pattern.ts";
import type { Piece } from "./terminal-output-types.ts";
import { outputOmission } from "./format-output-omission.ts";
import { shortenLine } from "./lines/shorten-line.ts";
import { takePieces } from "./budget/take-pieces.ts";
import type { OutputGap } from "./terminal-output-types.ts";

/** Presentation only; retained command text is never rewritten. Offsets address value, not folded text. */
export function compactTerminalOutput(value: string, command: string, options: TerminalOptions, commandId?: string, gap?: OutputGap): { output: string; truncated: boolean } {
  const pieces: Piece[] = [];
  const clean = gap ? "" : stripVTControlCharacters(value);
  // ANSI removal and bounded captures have no complete source map.
  const mapped = clean === value && gap === undefined;
  let previous: string | undefined;
  let count = 0, truncated = gap !== undefined, position = 0, groupStart = 0, groupEnd = 0, groupChars = 0;
  let pattern: RegExp | undefined, parsed = false;
  const flush = () => {
    if (previous === undefined) return;
    if (!parsed && previous.length > options.longLineThresholdChars) { pattern = searchPattern(command); parsed = true; }
    const shortened = shortenLine(previous, pattern, options, mapped ? groupStart : undefined, commandId);
    truncated ||= shortened.some((piece) => piece.hidden !== undefined);
    pieces.push(...shortened);
    if (groupChars > previous.length) pieces.push({ text: count > 1 && previous ? ` ×${count}` : "", offset: mapped ? groupStart + Buffer.byteLength(previous) : undefined, end: mapped ? groupEnd : undefined, hidden: groupChars - previous.length });
  };
  const segments = gap ? [stripVTControlCharacters(value.slice(0, gap.at)), stripVTControlCharacters(value.slice(gap.at))] : [clean];
  for (const [index, segment] of segments.entries()) {
    if (index) {
      flush();
      previous = undefined;
      pieces.push({ text: `\n${outputOmission(gap!.chars)}\n`, hidden: gap!.chars });
    }
    for (const row of segment.split("\n")) {
      const end = row.endsWith("\r") ? row.length - 1 : row.length;
      const start = row.lastIndexOf("\r", end - 1) + 1;
      const latest = row.slice(start, end);
      const line = latest.trim().length ? latest : "";
      if (line === previous) { count++; groupChars += 1 + row.length - start; }
      else {
        flush();
        if (previous !== undefined) pieces.push({ text: "\n", offset: mapped ? groupEnd : undefined, end: mapped ? groupEnd + 1 : undefined });
        previous = line; count = 1; groupStart = position + Buffer.byteLength(row.slice(0, start)); groupChars = row.length - start;
      }
      groupEnd = position + Buffer.byteLength(row);
      position = groupEnd + 1;
    }
  }
  flush();
  const output = pieces.map((piece) => piece.text).join("");
  if (Buffer.byteLength(output) <= options.outputBytes) return { output, truncated };
  const chars = (part: Piece[]) => part.reduce((sum, piece) => sum + (piece.hidden ?? piece.text.length), 0);
  // Prefer a full hint; if the cap cannot hold it, keep the omitted count alone.
  const hintId = Buffer.byteLength(outputOmission(Math.max(value.length, chars(pieces)), mapped ? Buffer.byteLength(value) : undefined, commandId)) <= options.outputBytes ? commandId : undefined;
  const reserve = Buffer.byteLength(outputOmission(Math.max(value.length, chars(pieces)), mapped ? Buffer.byteLength(value) : undefined, hintId));
  const available = Math.max(0, options.outputBytes - reserve);
  const head = takePieces(pieces, Math.floor(available / 2));
  const tail = takePieces(pieces, Math.floor(available / 2), true);
  const offset = head.length ? head.at(-1)!.end : pieces[0]?.offset;
  const marker = outputOmission(chars(pieces) - chars(head) - chars(tail), offset, hintId);
  // Tiny configured budgets cannot carry a complete marker; emit only complete text.
  if (Buffer.byteLength(marker) > options.outputBytes) return { output: takePieces(pieces, options.outputBytes).map((piece) => piece.text).join(""), truncated: true };
  return { output: head.map((piece) => piece.text).join("") + marker + tail.map((piece) => piece.text).join(""), truncated: true };
}
