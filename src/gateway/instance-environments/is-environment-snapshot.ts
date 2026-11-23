import { object } from "../wire/is-record.ts";
import { keys } from "../wire/fields/has-only-fields.ts";
import type { TargetEnvironmentSnapshot } from "./environment-types.ts";

export function isEnvironmentSnapshot(value: unknown): value is TargetEnvironmentSnapshot {
  if (!object(value) || !keys(value, ["target", "streamId", "revision", "status", "transferredBytes", "totalBytes", "percent", "bytesPerSecond", "error"])) return false;
  if (typeof value.target !== "string" || !value.target || typeof value.streamId !== "string" || !value.streamId || typeof value.status !== "string" || !["idle", "checking", "transferring", "ready", "failed"].includes(value.status)) return false;
  if (![value.revision, value.transferredBytes, value.totalBytes].every((item) => typeof item === "number" && Number.isSafeInteger(item) && item >= 0)) return false;
  if (typeof value.percent !== "number" || !Number.isFinite(value.percent) || value.percent < 0 || value.percent > 100 || typeof value.bytesPerSecond !== "number" || !Number.isFinite(value.bytesPerSecond) || value.bytesPerSecond < 0) return false;
  if (value.error !== undefined && (!object(value.error) || !keys(value.error, ["code", "message", "details"]) || typeof value.error.code !== "string" || typeof value.error.message !== "string" || value.error.details !== undefined && !object(value.error.details))) return false;
  return value.status !== "failed" || value.error !== undefined;
}
