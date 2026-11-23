import { Buffer } from "node:buffer";
import { WireError } from "../../gateway/wire/create-error.ts";

export function validatePtyInput(data: string, inputBytes: number): void {
  if (Buffer.byteLength(data) > inputBytes) throw new WireError("TOO_LARGE", "Terminal input exceeds its byte limit.");
}
