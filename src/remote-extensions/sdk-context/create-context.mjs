import { readUi } from "./ui/read-ui.mjs";
import { hasUI } from "./ui/has-ui.mjs";
import { readMode } from "./execution/read-mode.mjs";
import { readCwd, getCwd } from "./session/read-cwd.mjs";
import { readSessionId } from "./session/read-session-id.mjs";
import { readSessionName } from "./session/read-session-name.mjs";
import { readSessionFile } from "./session/read-session-file.mjs";
import { readSessionManager } from "./session/read-session-manager.mjs";
import { readModel } from "./execution/read-model.mjs";
import { readThinkingLevel } from "./execution/read-thinking-level.mjs";
import { readSignal } from "./execution/read-signal.mjs";
import { isIdle } from "./execution/is-idle.mjs";
import { isProjectTrusted } from "./session/is-project-trusted.mjs";
import { hasPendingMessages } from "./execution/has-pending-messages.mjs";
import { readSystemPrompt } from "./session/read-system-prompt.mjs";
import { readActiveTools } from "./execution/read-active-tools.mjs";
import { executeTool } from "./execution/execute-tool.mjs";
import { readSessionBranch } from "./session/read-session-branch.mjs";

export function context(ctx, owner, operation, tool = false) {
  const members = {
    get ui() { return readUi(ctx, owner, operation); },
    get mode() { return readMode(ctx, owner); },
    get hasUI() { return hasUI(ctx, owner); },
    get cwd() { return readCwd(ctx, owner); },
    get sessionManager() { return readSessionManager(ctx, owner); },
    get model() { return readModel(ctx, owner); },
    get thinkingLevel() { return readThinkingLevel(ctx, owner); },
    get signal() { return readSignal(ctx, owner, operation); },
    isIdle: isIdle.bind(undefined, ctx, owner),
    isProjectTrusted: isProjectTrusted.bind(undefined, ctx, owner),
    hasPendingMessages: hasPendingMessages.bind(undefined, ctx, owner),
    getSystemPrompt: readSystemPrompt.bind(undefined, ctx, owner),
  };
  if (tool) members.executeTool = executeTool.bind(undefined, ctx, owner, operation);
  operation.uiContext = ctx.uiContext(owner, operation);
  return ctx.facade(owner, "ctx", members);
}

// Tree deviation: shared getters stay private; these public assembly method views
// bind their original implementations without cross-object deep imports or re-exports.
export function sessionManagerMembers(ctx, owner) {
  return {
    getSessionId: readSessionId.bind(undefined, ctx, owner),
    getSessionName: readSessionName.bind(undefined, ctx, owner),
    getSessionFile: readSessionFile.bind(undefined, ctx, owner),
    getCwd: getCwd.bind(undefined, ctx, owner),
    getBranch: readSessionBranch.bind(undefined, ctx, owner),
  };
}

export function readableActions(ctx, owner) {
  return {
    getActiveTools: readActiveTools.bind(undefined, ctx, owner),
    getSessionName: readSessionName.bind(undefined, ctx, owner),
    getThinkingLevel: readThinkingLevel.bind(undefined, ctx, owner),
  };
}
