import type { NativeActionRequest } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";

export function readSessionStats(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest, session: NativeTarget["session"]) {
  if (!session) {
    const context = target.manager.buildSessionContext();
    return { sessionId: target.sessionId, readOnly: true, messageCount: context.messages.length, entryCount: target.manager.getEntries().length, name: target.manager.getSessionName() };
  } else {
    const { sessionFile: _sessionFile, ...stats } = session.getSessionStats();
    return { ...stats, contextUsage: session.getContextUsage(), sessionId: session.sessionId };
  }
}
