import type { HistoryRecord, StoredSession } from "../history-types.ts";
import { invalid } from "../reject-invalid-history.ts";
import { projectAuthorityEntries } from "../format-authority-entries.ts";
import { latestSleeping } from "../metadata/read-sleep-state.ts";
import { archivedField } from "../archive/archived-field.ts";
import { latestProject } from "../metadata/read-project.ts";
import { oneBinding } from "../binding/read-creation-binding.ts";
import { latestRetarget } from "../binding/read-target-selection.ts";
import { readNativeSessionState } from "../read-native-session-state.ts";

export function stored(record: HistoryRecord): StoredSession {
  const limits = record.limits;
  const sessionId = record.manager.getSessionId();
  const sessionFile = record.manager.getSessionFile();
  if (sessionId !== record.sessionId || typeof sessionFile !== "string") invalid("session identity");
  record.sessionFile = sessionFile;
  const label = record.manager.getSessionName();
  if (label === undefined) invalid(`binding ${JSON.stringify(sessionId)} has no SDK title`);
  const entries = record.manager.getEntries();
  const authorityEntries = projectAuthorityEntries(record.manager, limits);
  const binding = oneBinding(authorityEntries, limits);
  if (!binding || binding.sessionId !== sessionId) invalid("binding session identity");
  latestRetarget(authorityEntries, limits);
  readNativeSessionState(record.manager, limits);
  return Object.freeze({
    target: record.target,
    label,
    cwd: record.cwd,
    sessionId,
    sessionFile,
    manager: record.manager,
    ...(latestSleeping(authorityEntries, limits) ? { sleeping: true } : {}),
    ...archivedField(authorityEntries, limits),
    ...latestProject(entries, limits),
  });
}
