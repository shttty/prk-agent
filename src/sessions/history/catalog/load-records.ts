import type { SessionReadFailure, HistoryRecord } from "../history-types.ts";
import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { resolve } from "node:path";
import { invalid } from "../reject-invalid-history.ts";
import { describeSession } from "../diagnostics/describe-session.ts";
import { recordReadIssue } from "../diagnostics/record-read-issue.ts";
import { loadRecord } from "./load-record.ts";
import { openHistoryFile } from "./open-history-file.ts";
import { indexRecords } from "./index-records.ts";

export async function loadRecords(directory: string, limits: LimitsOptions) {
  const readFailures = new Map<string, SessionReadFailure>();
  const loaded: HistoryRecord[] = [];
  const sessionInfos = await SessionManager.listAll(directory);
  for (const sessionInfo of sessionInfos) {
    const file = resolve(sessionInfo.path);
    let manager: SessionManager | undefined;
    try {
      if (typeof sessionInfo.id !== "string" || sessionInfo.id.trim().length === 0) invalid("binding session id at /id");
      manager = openHistoryFile(file, directory);
      const candidate = loadRecord(manager, file, sessionInfo.id, directory, limits);
      if (candidate) loaded.push(candidate);
    } catch (cause) {
      const details = manager ? describeSession(manager, limits) : { display: { location: "unknown" as const } };
      recordReadIssue(readFailures, {
        ...(sessionInfo.name === undefined ? {} : { label: sessionInfo.name }),
        ...details.display, sessionId: sessionInfo.id, sessionFile: file,
      }, cause, true);
    }
  }
  const sessions = indexRecords(loaded, readFailures);
  return { sessions, readFailures };
}
