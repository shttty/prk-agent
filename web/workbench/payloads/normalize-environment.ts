import type { TargetEnvironmentSnapshot } from "../../../src/gateway/wire/web-types.ts";
import { isRecord } from "./is-record.ts";

const STATUSES = ["idle", "checking", "transferring", "ready", "failed"] as const;
const count = (value: unknown): number => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;

/** `TargetEnvironmentSnapshot` (docs/wire/targets.md, 实例环境下发): the Gateway's state of one instance's remote
 * environment. Byte counts, percent and rate are the Gateway's ACK-based values, never derived here. */
export function normalizeEnvironment(value: unknown): TargetEnvironmentSnapshot | null {
  if (!isRecord(value) || typeof value.target !== "string" || typeof value.streamId !== "string" || typeof value.revision !== "number" || !Number.isSafeInteger(value.revision)) return null;
  const status = STATUSES.find((candidate) => candidate === value.status);
  if (!status) return null;
  return {
    target: value.target,
    streamId: value.streamId,
    revision: value.revision,
    status,
    transferredBytes: count(value.transferredBytes),
    totalBytes: count(value.totalBytes),
    percent: Math.min(100, count(value.percent)),
    bytesPerSecond: count(value.bytesPerSecond),
    ...(isRecord(value.error) ? { error: { code: typeof value.error.code === "string" ? value.error.code : "", message: typeof value.error.message === "string" ? value.error.message : "", ...(isRecord(value.error.details) ? { details: value.error.details } : {}) } } : {}),
  };
}
