import { isRecord } from "./is-record.js";
import { normalizeEnvironment } from "./normalize-environment.js";
export function normalizeTarget(target) {
  if (!isRecord(target) || typeof target.id !== "string" || !target.id.trim()) return null;
  const environment = normalizeEnvironment(target.environment);
  return {
    id: target.id,
    label: typeof target.label === "string" && target.label.trim() ? target.label : "未命名实例",
    local: target.local === true,
    tags: Array.isArray(target.tags)
      ? target.tags.filter((tag) => typeof tag === "string" && tag.trim()).map((tag) => tag.trim())
      : [],
    ...(typeof target.python === "string" && target.python ? { python: target.python } : {}),
    ...(isRecord(target.configurationIssue) && typeof target.configurationIssue.code === "string"
      ? { configurationIssue: { code: target.configurationIssue.code, message: typeof target.configurationIssue.message === "string" ? target.configurationIssue.message : "" } }
      : {}),
    ...(environment ? { environment } : {}),
  };
}

