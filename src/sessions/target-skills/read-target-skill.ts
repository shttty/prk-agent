import { Buffer } from "node:buffer";
import type { TargetLease } from "../../target-channel/lease/lease-types.ts";

export async function readTargetSkill(lease: TargetLease, path: string): Promise<Buffer> {
  // Native ReadOperations needs the complete file for offsets and line counts;
  // createReadToolDefinition applies its own 50KB / 2000-line output limit.
  const reply = await lease.request("skills", "read", { path, maxBytes: null });
  if (typeof reply.data !== "string" || reply.truncated === true) throw new Error("Incomplete target skill read response.");
  return Buffer.from(reply.data, "base64");
}
