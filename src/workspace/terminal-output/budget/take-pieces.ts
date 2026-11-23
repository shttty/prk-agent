import { Buffer } from "node:buffer";
import type { Piece } from "../terminal-output-types.ts";

// Markers are atomic: a byte cap may shorten retained text, never a continuation hint.
export function takePieces(pieces: Piece[], budget: number, tail = false): Piece[] {
  const kept: Piece[] = [];
  for (const piece of tail ? pieces.toReversed() : pieces) {
    const bytes = Buffer.from(piece.text);
    if (bytes.length <= budget) {
      kept.push(piece);
      budget -= bytes.length;
      continue;
    }
    if (piece.hidden !== undefined) break;
    let start = tail ? bytes.length - budget : 0;
    let end = tail ? bytes.length : budget;
    while (start < end && (bytes[start]! & 0xc0) === 0x80) start++;
    while (end > start && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end--;
    if (end > start) kept.push({ text: bytes.toString("utf8", start, end), offset: piece.offset === undefined ? undefined : piece.offset + start, end: piece.offset === undefined ? undefined : piece.offset + end });
    break;
  }
  return tail ? kept.reverse() : kept;
}
