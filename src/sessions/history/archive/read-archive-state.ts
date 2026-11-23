import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import type { ArchivedState } from "../history-types.ts";
import { latestCustomEntry } from "../metadata/find-latest-metadata.ts";
import { ARCHIVED_STATE_TYPE } from "../history-protocol.ts";
import { isRecord } from "../metadata/is-history-metadata-record.ts";
import { invalid } from "../reject-invalid-history.ts";
import { validateMetadataSessionId } from "../identity/validate-metadata-session-id.ts";
import { validateArchiveGroup } from "./validate-archive-group.ts";

export function latestArchivedState(entries: readonly SessionEntry[], limits: LimitsOptions): ArchivedState | undefined {
  const entry = latestCustomEntry(entries, ARCHIVED_STATE_TYPE);
  if (entry === undefined) return undefined;
  const data: unknown = entry.data;
  if (!isRecord(data)) invalid("session archive metadata at /");
  const badKey = Object.keys(data).find((key) => !["version", "sessionId", "trashed", "group", "at", "kernelOrphan"].includes(key));
  if (badKey !== undefined) invalid(`session archive metadata at /${badKey.replaceAll("~", "~0").replaceAll("/", "~1")}`);
  if (data.version !== 1) invalid("session archive metadata at /version");
  if (typeof data.trashed !== "boolean") invalid("session archive metadata at /trashed");
  validateMetadataSessionId(data.sessionId, "session archive subject", limits);
  if (!data.trashed) return undefined;
  if (typeof data.group !== "string") invalid("session archive metadata at /group");
  if (typeof data.at !== "string") invalid("session archive metadata at /at");
  if (data.kernelOrphan !== undefined && typeof data.kernelOrphan !== "boolean") invalid("session archive metadata at /kernelOrphan");
  validateArchiveGroup(data.group, limits);
  return { group: data.group, at: data.at, ...(data.kernelOrphan ? { kernelOrphan: true } : {}) };
}
