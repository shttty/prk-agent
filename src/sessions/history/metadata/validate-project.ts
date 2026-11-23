import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { isRecord } from "./is-history-metadata-record.ts";
import { invalid } from "../reject-invalid-history.ts";
import { isAbsolute } from "node:path";

export function projectValue(value: unknown, limits: LimitsOptions): { id: string; name: string } | null {
  if (value === null) return null;
  if (!isRecord(value)) invalid("project membership at /project");
  const badKey = Object.keys(value).find((key) => !["id", "name"].includes(key));
  if (badKey !== undefined) invalid(`project membership at /project/${badKey.replaceAll("~", "~0").replaceAll("/", "~1")}`);
  if (typeof value.id !== "string" || value.id.trim().length === 0 || value.id.length > limits.identityChars || /\p{Cc}/u.test(value.id)
    || value.id === "." || value.id === ".." || value.id.includes("/") || value.id.includes("\\") || isAbsolute(value.id)) invalid("project membership at /project/id");
  if (typeof value.name !== "string" || value.name.trim().length === 0 || value.name.length > limits.labelChars || /\p{Cc}/u.test(value.name)) invalid("project membership at /project/name");
  return { id: value.id, name: value.name.trim() };
}
