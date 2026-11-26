import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import type { HistoryRecord } from "../history-types.ts";
import { invalid } from "../reject-invalid-history.ts";
import { projectAuthorityEntries } from "../format-authority-entries.ts";
import { oneBinding } from "../binding/read-creation-binding.ts";
import { latestProject } from "../metadata/read-project.ts";
import { sessionFile } from "../identity/validate-sdk-file.ts";
import { latestRetarget } from "../binding/read-target-selection.ts";
import { latestArchivedState } from "../archive/read-archive-state.ts";
import { latestSleeping } from "../metadata/read-sleep-state.ts";
import { readNativeSessionState } from "../read-native-session-state.ts";
import { openHistoryFile } from "./open-history-file.ts";

/** Nothing enters the catalog until the complete file has passed validation. */
export function loadRecord(
  manager: SessionManager,
  file: string,
  expectedId: string,
  directory: string,
  limits: LimitsOptions,
): HistoryRecord | undefined {
  const id = manager.getSessionId();
  const header = manager.getHeader();
  if (typeof id !== "string" || id.trim().length === 0 || !header || header.id !== id || expectedId !== id) invalid("binding session id at /id");
  const authorityEntries = projectAuthorityEntries(manager, limits);
  const binding = oneBinding(authorityEntries, limits);
  if (!binding) return undefined;
  if (binding.sessionId !== id) invalid("binding session identity at /sessionId");
  latestProject(manager.getEntries(), limits);
  latestArchivedState(authorityEntries, limits);
  latestSleeping(authorityEntries, limits);
  readNativeSessionState(manager, limits);
  const actualFile = sessionFile(manager, file);
  if (manager.getSessionName() === undefined) invalid(`session ${JSON.stringify(id)} has no SDK title`);
  const retarget = latestRetarget(authorityEntries, limits);
  const cwd = retarget?.cwd ?? binding.cwd;
  const record: HistoryRecord = {
    target: retarget?.target ?? binding.target,
    cwd, sessionId: id, sessionFile: actualFile,
    manager: manager.getCwd() === cwd ? manager : openHistoryFile(file, directory, cwd), limits,
  };
  return record;
}
