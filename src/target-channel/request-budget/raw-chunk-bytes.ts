import type { ProcessWindowLimits } from "../../target-environment/process-window/window-state.ts";

/** Base64 contains no JSON escapes; reserve the largest supported request-id encoding. */
export function rawChunkBytes(limits: ProcessWindowLimits, mod: string, op: string, fields: Record<string, unknown>, maximum: number): number {
  const overhead = Buffer.byteLength(JSON.stringify({ ...fields, data: "", id: Number.MAX_SAFE_INTEGER, mod, op })) + 1;
  const bytes = Math.min(maximum, Math.floor((limits.maxFrameBytes - overhead) / 4) * 3);
  if (bytes < 1) throw Object.assign(new Error("Process frame budget cannot contain a payload chunk"), { code: "FRAME_TOO_LARGE" });
  return bytes;
}
