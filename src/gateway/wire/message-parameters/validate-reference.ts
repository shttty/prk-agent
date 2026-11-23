import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import type { WireReference } from "../wire-types.ts";
import { object } from "../is-record.ts";
import { keys } from "../fields/has-only-fields.ts";
import { fieldText } from "../fields/is-field-text.ts";

export function validReference(value: unknown, limits: LimitsOptions): value is WireReference {
  if (!object(value) || !keys(value, ["type", "source", "path", "text", "name", "target", "sessionId", "label"])) return false;
  if (value.type !== "target-file" && value.type !== "browser-upload" && value.type !== "text") return false;
  if (value.source !== "session-target" && value.source !== "browser" && value.source !== "user") return false;
  for (const key of ["path", "text", "name", "target", "sessionId", "label"]) {
    const candidate = value[key];
    if (candidate !== undefined && !fieldText(candidate, key === "text" ? limits.referenceTextChars : limits.referenceFieldChars)) return false;
  }
  if (value.type === "target-file" && (value.source !== "session-target" || typeof value.path !== "string" || value.path.includes("\\") || value.path.startsWith("/") || value.path.split("/").some((part) => part === "." || part === ".."))) return false;
  if (value.type === "text" && typeof value.text !== "string") return false;
  return true;
}
