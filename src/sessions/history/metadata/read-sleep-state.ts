import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { latestCustomEntry } from "./find-latest-metadata.ts";
import { SESSION_SLEEP_TYPE } from "../history-protocol.ts";
import { isRecord } from "./is-history-metadata-record.ts";
import { invalid } from "../reject-invalid-history.ts";
import { validateMetadataSessionId } from "../identity/validate-metadata-session-id.ts";

export function latestSleeping(entries: readonly SessionEntry[], limits: LimitsOptions): boolean {
  const entry = latestCustomEntry(entries, SESSION_SLEEP_TYPE);
  if (entry === undefined) return false;
  if (!isRecord(entry.data)) invalid("session sleep metadata at /");
  if (entry.data.version !== 1) invalid("session sleep metadata at /version");
  if (typeof entry.data.sleeping !== "boolean") invalid("session sleep metadata at /sleeping");
  validateMetadataSessionId(entry.data.sessionId, "session sleep subject", limits);
  return entry.data.sleeping;
}
