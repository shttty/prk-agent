import type { TargetRow } from "../store/targets/target-types.ts";
import { isRecord } from "./is-record.ts";
import { normalizeEnvironment } from "./normalize-environment.ts";

export function normalizeTarget(target: unknown): TargetRow | null {
  if (!isRecord(target) || typeof target.id !== "string" || !target.id.trim()) return null;
  const environment = normalizeEnvironment(target.environment);
  const issue = target.configurationIssue;
  return {
    id: target.id,
    label: typeof target.label === "string" && target.label.trim() ? target.label : "未命名实例",
    local: target.local === true,
    tags: Array.isArray(target.tags)
      ? target.tags.filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim())).map((tag) => tag.trim())
      : [],
    ...(typeof target.python === "string" && target.python ? { python: target.python } : {}),
    ...(isRecord(issue) && issue.code === "SSH_COMMAND_REQUIRED"
      ? { configurationIssue: { code: issue.code, message: typeof issue.message === "string" ? issue.message : "" } }
      : {}),
    ...(environment ? { environment } : {}),
  };
}
