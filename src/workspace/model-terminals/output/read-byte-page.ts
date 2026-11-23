import { Buffer } from "node:buffer";

/** UTF-8 byte offsets are stable across pages; never return half a code point. */
export function bytePage(value: string, offset: number, length: number): string {
  const bytes = Buffer.from(value);
  let start = Math.min(offset, bytes.length);
  while (start < bytes.length && (bytes[start]! & 0xc0) === 0x80) start++;
  let end = Math.min(start + length, bytes.length);
  while (end > start && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end--;
  return bytes.toString("utf8", start, end);
}
