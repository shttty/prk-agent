import type { HistoryContext, HistoryRecord } from "../history-types.ts";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { validateLabel } from "../metadata/validate-label.ts";
import { getRecord } from "../catalog/find-record.ts";
import { validateMetadataSessionId } from "../identity/validate-metadata-session-id.ts";
import { invalid } from "../reject-invalid-history.ts";
import { resolve } from "node:path";
import { unlinkSync } from "node:fs";
import { BINDING_TYPE, BINDING_VERSION } from "../history-protocol.ts";
import { sessionFile } from "../identity/validate-sdk-file.ts";

export function cloneSession(ctx: HistoryContext, sourceSessionId: string, label: string, entryId?: string): SessionManager {
  const { limits, directory, records } = ctx;
  validateMetadataSessionId(sourceSessionId, "source session identity", limits);
  validateLabel(label);
  const source = getRecord(ctx, sourceSessionId);
  if (source === undefined) invalid(`unknown session ${JSON.stringify(sourceSessionId)}`);
  const sourceId = source.sessionId;
  const sourceFile = resolve(source.sessionFile);
  const sourceActiveLeaf = source.manager.getLeafId();
  const sourceLeaf = entryId ?? sourceActiveLeaf;
  if (sourceLeaf === null) invalid("source session has no active branch");
  if (entryId !== undefined) {
    const point = source.manager.getEntry(entryId);
    if (point?.type !== "message" || point.message.role !== "assistant"
      || point.message.content.some((part) => part.type === "toolCall")) {
      invalid("fork point must be a persisted assistant reply without pending tool calls");
    }
  }
  const detached = SessionManager.open(sourceFile, directory, source.cwd);
  const detachedFile = detached.getSessionFile();
  if (detached === source.manager || detached.getSessionId() !== sourceId
    || detachedFile === undefined || resolve(detachedFile) !== sourceFile
    || detached.getEntry(sourceLeaf) === undefined) invalid("source session changed while cloning");
  const selectedBranch = detached.getBranch(sourceLeaf);
  if (!selectedBranch.some((entry) => entry.type === "message" && entry.message.role === "assistant")) invalid("SDK does not persist assistant-free cloned sessions");
  let cloneFile: string | undefined;
  try {
    cloneFile = detached.createBranchedSession(sourceLeaf);
    if (typeof cloneFile !== "string" || resolve(cloneFile) === sourceFile) invalid("clone session file");
    cloneFile = resolve(cloneFile);
    const manager = SessionManager.open(cloneFile, directory, source.cwd);
    const sessionId = manager.getSessionId();
    validateMetadataSessionId(sessionId, "clone session id", limits);
    const header = manager.getHeader();
    if (!header || header.id !== sessionId) invalid("clone session identity");
    manager.appendSessionInfo(label);
    manager.appendCustomEntry(BINDING_TYPE, {
      version: BINDING_VERSION, target: source.target, sessionId,
      cwd: source.cwd,
    });
    const actualFile = sessionFile(manager, cloneFile);
    const sourceManagerFile = source.manager.getSessionFile();
    if (source.manager.getSessionId() !== sourceId || sourceManagerFile === undefined
      || resolve(sourceManagerFile) !== sourceFile || source.manager.getLeafId() !== sourceActiveLeaf) invalid("source session changed while cloning");
    const record: HistoryRecord = {
      target: source.target,
      cwd: source.cwd, sessionId, sessionFile: actualFile,
      manager, limits,
    };
    records.set(sessionId, record);
    return manager;
  } catch (error) {
    if (cloneFile !== undefined && resolve(cloneFile) !== sourceFile) {
      try {
        unlinkSync(cloneFile);
      } catch { /* Preserve the clone failure. */ }
    }
    throw error;
  }
}
