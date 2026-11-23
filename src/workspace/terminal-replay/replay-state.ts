import { Buffer } from "node:buffer";

export interface ReplayContext {
  readonly bytes: Buffer;
  end: number;
  length: number;
  /** Bytes ever appended; the ring holds absolute offsets `total - length .. total`. */
  total: number;
  /** String controls (DCS, OSC, APC, PM, SOS) that may reach into the ring: flat `[start, end, osc]` triples of absolute
   * offsets (start at the ESC, end at the terminating byte, -1 while still open; osc 1 for OSC). */
  strings: number[];
  /** Scanner state carried across appends: 0 ground, 1 after ESC, 2 inside a string control. */
  mode: 0 | 1 | 2;
  /** Absolute offset of the last ESC while `mode` is 1. */
  escapeAt: number;
}
