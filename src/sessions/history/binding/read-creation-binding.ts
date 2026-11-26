import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import type { SessionBinding } from "../history-types.ts";
import { BINDING_TYPE, BINDING_VERSION } from "../history-protocol.ts";
import { isRecord } from "../metadata/is-history-metadata-record.ts";
import { invalid } from "../reject-invalid-history.ts";
import { validateTarget } from "./validate-target.ts";
import { validateKernelCwd } from "./validate-kernel-cwd.ts";
import { validateMetadataSessionId } from "../identity/validate-metadata-session-id.ts";

export function oneBinding(entries: readonly SessionEntry[], limits: LimitsOptions): SessionBinding | undefined {
  const bindings = entries.filter((entry): entry is Extract<SessionEntry, { type: "custom" }> => entry.type === "custom" && entry.customType === BINDING_TYPE);
  if (bindings.length === 0) return undefined;
  if (bindings.length !== 1) invalid("binding (duplicate entries)");
  const data: unknown = bindings[0]?.data;
  if (!isRecord(data)) invalid("binding data at /");
  const allowed = ["target", "version", "cwd", "sessionId"];
  const badKey = Object.keys(data).find((key) => !allowed.includes(key))
    ?? allowed.find((key) => !Object.hasOwn(data, key));
  if (badKey !== undefined) invalid(`binding data at /${badKey.replaceAll("~", "~0").replaceAll("/", "~1")}`);
  if (data.version !== BINDING_VERSION) invalid("binding data at /version");
  if (typeof data.target !== "string") invalid("binding data at /target");
  try { validateTarget(data.target); } catch { invalid("binding data at /target"); }
  const cwd = data.cwd;
  validateKernelCwd(cwd, limits);
  const sessionId = data.sessionId;
  validateMetadataSessionId(sessionId, "binding subject", limits);
  return {
    sessionId,
    target: data.target,
    cwd,
  };
}
