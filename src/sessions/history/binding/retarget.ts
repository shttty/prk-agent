import type { HistoryContext, SessionRetarget } from "../history-types.ts";
import { openHistoryFile } from "../catalog/open-history-file.ts";
import { invalid } from "../reject-invalid-history.ts";
import { validateTarget } from "./validate-target.ts";
import { validateKernelCwd } from "./validate-kernel-cwd.ts";
import { SESSION_RETARGET_TYPE } from "../history-protocol.ts";

export function retarget(ctx: HistoryContext, sessionId: string, selection: SessionRetarget): void {
  const { records, limits, directory } = ctx;
  const record = records.get(sessionId);
  if (record === undefined) invalid(`unknown session ${JSON.stringify(sessionId)}`);
  validateTarget(selection.target);
  validateKernelCwd(selection.cwd, limits);
  record.manager.appendCustomEntry(SESSION_RETARGET_TYPE, {
    version: 2, sessionId: record.manager.getSessionId(), target: selection.target,
    cwd: selection.cwd,
  });
  record.target = selection.target;
  record.cwd = selection.cwd;
  record.manager = openHistoryFile(record.sessionFile, directory, selection.cwd);
}
