import type { HistoryContext, HistoryRecord } from "../history-types.ts";
import type { SessionManager } from "@earendil-works/pi-coding-agent";
import { validateTarget } from "../binding/validate-target.ts";
import { validateKernelCwd } from "../binding/validate-kernel-cwd.ts";
import { createFile } from "./create-sdk-file.ts";
import { validateMetadataSessionId } from "../identity/validate-metadata-session-id.ts";
import { BINDING_TYPE, BINDING_VERSION } from "../history-protocol.ts";
import { invalid } from "../reject-invalid-history.ts";

export function create(ctx: HistoryContext, target: string, label: string, sessionCwd: string): SessionManager {
  const { limits, records } = ctx;
  validateTarget(target);
  validateKernelCwd(sessionCwd, limits);
  const created = createFile(ctx, label, sessionCwd, (manager) => {
    const sessionId = manager.getSessionId();
    validateMetadataSessionId(sessionId, "new session id", limits);
    manager.appendCustomEntry(BINDING_TYPE, {
      version: BINDING_VERSION, target, sessionId,
      cwd: sessionCwd,
    });
  });
  const sessionId = created.manager.getSessionId();
  const header = created.manager.getHeader();
  if (typeof sessionId !== "string" || sessionId.trim().length === 0 || !header || header.id !== sessionId) invalid("new session id");
  const record: HistoryRecord = {
    target,
    cwd: sessionCwd,
    sessionId, sessionFile: created.file, manager: created.manager,
    limits,
  };
  records.set(sessionId, record);
  return created.manager;
}
