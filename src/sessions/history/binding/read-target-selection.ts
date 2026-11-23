import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import type { SessionRetarget } from "../history-types.ts";
import { latestCustomEntry } from "../metadata/find-latest-metadata.ts";
import { SESSION_RETARGET_TYPE } from "../history-protocol.ts";
import { isRecord } from "../metadata/is-history-metadata-record.ts";
import { invalid } from "../reject-invalid-history.ts";
import { validateMetadataSessionId } from "../identity/validate-metadata-session-id.ts";
import { validateTarget } from "./validate-target.ts";
import { validateKernelCwd } from "./validate-kernel-cwd.ts";

export function latestRetarget(entries: readonly SessionEntry[], limits: LimitsOptions): SessionRetarget | undefined {
  const entry = latestCustomEntry(entries, SESSION_RETARGET_TYPE);
  if (entry === undefined) return undefined;
  const data: unknown = entry.data;
  if (!isRecord(data)) invalid("session retarget metadata at /");
  const allowed = ["version", "sessionId", "target", "cwd"];
  const badKey = Object.keys(data).find((key) => !allowed.includes(key)) ?? allowed.find((key) => !Object.hasOwn(data, key));
  if (badKey !== undefined) invalid(`session retarget metadata at /${badKey.replaceAll("~", "~0").replaceAll("/", "~1")}`);
  if (data.version !== 2) invalid("session retarget metadata at /version");
  if (typeof data.target !== "string") invalid("session retarget metadata at /target");
  validateMetadataSessionId(data.sessionId, "session retarget subject", limits);
  validateTarget(data.target);
  validateKernelCwd(data.cwd, limits);
  return { target: data.target, cwd: data.cwd };
}
