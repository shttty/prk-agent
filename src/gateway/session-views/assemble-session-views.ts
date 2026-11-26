import { stored } from "./selection/read-stored-session.ts";
import { storedSession } from "./selection/require-stored-session.ts";
import { workbenchSnapshot } from "./snapshots/format-workbench.ts";
import { managedSessionSnapshot } from "./snapshots/format-session.ts";
import { managed } from "./snapshots/format-managed-sessions.ts";
import { unavailableSession } from "./snapshots/unavailable-session.ts";
import { archivedSnapshot } from "./snapshots/format-archived-snapshot.ts";
import { archivedStream } from "./snapshots/read-archived-stream.ts";
import { historicalResult } from "./snapshots/format-recovery-result.ts";
import { decorateSnapshot } from "./snapshots/format-active-snapshot.ts";
import { projectExtensionRender } from "./extension-ui/format-extension-render.ts";
import { sessionHost } from "./get-session-host.ts";
import { forgetHost } from "./host-binding/forget-session-host.ts";
import { history } from "./history/read-history.ts";
import { historyPage } from "./history/read-history-page.ts";
import { toolContent } from "./history/read-tool-content.ts";
import { kernelResult } from "./history/read-kernel-result.ts";
import { sessionPrompt } from "./prompt/read-session-prompt.ts";
import { state } from "./snapshots/read-state.ts";
import type { HostContext } from "../host/host-state.ts";
import type { SessionViewsMethods } from "./session-views-methods.ts";

export function assembleSessionViews(ctx: HostContext): SessionViewsMethods {
  ctx.views.reportedUnreadableSessions = new Set();
  return {
    stored: stored.bind(undefined, ctx),
    storedSession: storedSession.bind(undefined, ctx),
    workbenchSnapshot: workbenchSnapshot.bind(undefined, ctx),
    managedSessionSnapshot: managedSessionSnapshot.bind(undefined, ctx),
    managed: managed.bind(undefined, ctx),
    unavailableSession: unavailableSession.bind(undefined, ctx),
    archivedSnapshot: archivedSnapshot.bind(undefined, ctx),
    archivedStream: archivedStream.bind(undefined, ctx),
    historicalResult: historicalResult.bind(undefined, ctx),
    decorateSnapshot: decorateSnapshot.bind(undefined, ctx),
    projectExtensionRender: projectExtensionRender.bind(undefined, ctx),
    sessionHost: sessionHost.bind(undefined, ctx),
    forgetHost: forgetHost.bind(undefined, ctx),
    history: history.bind(undefined, ctx),
    historyPage: historyPage.bind(undefined, ctx),
    toolContent: toolContent.bind(undefined, ctx),
    kernelResult: kernelResult.bind(undefined, ctx),
    sessionPrompt: sessionPrompt.bind(undefined, ctx),
    state: state.bind(undefined, ctx),
  };
}
