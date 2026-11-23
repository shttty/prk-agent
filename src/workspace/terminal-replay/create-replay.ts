import { Buffer } from "node:buffer";
import type { ReplayContext } from "./replay-state.ts";
import { appendOutput } from "./append-output.ts";
import { readSnapshot } from "./read-snapshot.ts";

/** Fixed-size UTF-8 ring; evict whole code points rather than partial bytes. */
export class TerminalReplay implements ReplayContext {
  readonly bytes: Buffer;
  end = 0;
  length = 0;
  total = 0;
  strings: number[] = [];
  mode: 0 | 1 | 2 = 0;
  escapeAt = 0;

  constructor(capacity: number) { this.bytes = Buffer.alloc(capacity); }

  append(data: string): void { appendOutput(this, data); }

  snapshot(): string { return readSnapshot(this); }
}
