import { createHash } from "node:crypto";

export function toolContentVersion(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value) ?? "null").digest("hex");
}
