import { Buffer } from "node:buffer";
import type { Command } from "../model-terminals-types.ts";
import { retainText } from "./retain-text.ts";
import { bytePage } from "./read-byte-page.ts";

export function renderRetained(retained: NonNullable<Command["retained"]>, pending: string): string {
  const view = { ...retained };
  retainText(view, pending);
  const headBytes = Buffer.byteLength(view.head);
  const tailBytes = Buffer.byteLength(view.tail);
  const discarded = view.bytes - headBytes - tailBytes;
  if (discarded <= 0) return `${view.head}…[discarded 0 bytes]…${bytePage(view.tail, -discarded, tailBytes)}`;
  return `${view.head}…[discarded ${discarded} bytes]…${view.tail}`;
}
