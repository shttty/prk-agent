import { Buffer } from "node:buffer";
import type { Command } from "../model-terminals-types.ts";
import { bytePage } from "./read-byte-page.ts";

/** Append committed xterm text, not PTY controls or mutable screen rows. */
export function retainText(retained: NonNullable<Command["retained"]>, text: string): void {
  const headBytes = Buffer.byteLength(retained.head);
  if (retained.bytes === headBytes && headBytes < retained.headLimit) {
    retained.head += bytePage(text, 0, retained.headLimit - headBytes);
  }
  const tail = retained.tail + text;
  const bytes = Buffer.byteLength(tail);
  retained.tail = bytePage(tail, Math.max(0, bytes - retained.tailLimit), retained.tailLimit);
  retained.bytes += Buffer.byteLength(text);
}
