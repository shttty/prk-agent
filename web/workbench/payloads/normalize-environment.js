import { isRecord } from "./is-record.js";
const STATUSES = new Set(["idle", "checking", "transferring", "ready", "failed"]);
const count = (value) => Number.isFinite(value) && value >= 0 ? value : 0;
/** `TargetEnvironmentSnapshot` (docs/wire/targets.md, 实例环境下发): the Gateway's state of one instance's remote
 * environment. Byte counts, percent and rate are the Gateway's ACK-based values, never derived here. */
export function normalizeEnvironment(value) {
  if (!isRecord(value) || typeof value.target !== "string" || typeof value.streamId !== "string" || !Number.isSafeInteger(value.revision) || !STATUSES.has(value.status)) return null;
  return {
    target: value.target,
    streamId: value.streamId,
    revision: value.revision,
    status: value.status,
    transferredBytes: count(value.transferredBytes),
    totalBytes: count(value.totalBytes),
    percent: Math.min(100, count(value.percent)),
    bytesPerSecond: count(value.bytesPerSecond),
    ...(isRecord(value.error) ? { error: { code: typeof value.error.code === "string" ? value.error.code : "", message: typeof value.error.message === "string" ? value.error.message : "", ...(isRecord(value.error.details) ? { details: value.error.details } : {}) } } : {}),
  };
}
