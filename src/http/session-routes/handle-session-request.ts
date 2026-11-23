import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { routeSessionPath } from "./parse-session-route.ts";
import { validateSessionMethod } from "./validate-session-method.ts";
import { readState } from "./read-state.ts";
import { streamSession } from "../observations/stream-session.ts";
import { handleNativeRequest } from "./handle-native-request.ts";
import { readHistory } from "./read-history.ts";
import { readHistoryPage } from "./read-history-page.ts";
import { readToolContent } from "./read-tool-content.ts";
import { readKernelResult } from "./read-kernel-result.ts";
import { wakeSession } from "./wake-session.ts";
import { recoverSession } from "./recover-session.ts";
import { assignSessionProject } from "./assign-project.ts";
import { manageSessionRequest } from "./manage-session.ts";
import { renameSession } from "./rename-session.ts";
import { previewArchive } from "../archive-routes/preview-archive.ts";
import { archiveSession } from "../archive-routes/archive-session.ts";
import { sendInput } from "./send-input.ts";
import { cancelOperation } from "./cancel-operation.ts";
import { interruptKernel } from "./interrupt-kernel.ts";

export async function handleSessionRequest(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const route = routeSessionPath(ctx.limits, url.pathname);
  if (!route) throw new HttpError(404, "Endpoint not found.");
  const { action, sessionId } = route;
  validateSessionMethod(request, action);
  if (action === undefined) {
    await readState(ctx, request, response, sessionId);
  } else if (action === "events") {
    await streamSession(ctx, request, response, sessionId);
  } else if (action === "native") {
    await handleNativeRequest(ctx, request, response, sessionId, url);
  } else if (action === "history") {
    await readHistory(ctx, request, response, sessionId, url);
  } else if (action === "history-page") {
    await readHistoryPage(ctx, response, sessionId, url);
  } else if (action === "tool-content") {
    await readToolContent(ctx, request, response, sessionId, url);
  } else if (action === "kernel/result") {
    await readKernelResult(ctx, response, sessionId, url);
  } else if (action === "wake") {
    await wakeSession(ctx, request, response, sessionId);
  } else if (action === "recover") {
    await recoverSession(ctx, request, response, sessionId);
  } else if (action === "project") {
    await assignSessionProject(ctx, request, response, sessionId);
  } else if (action === "manage") {
    await manageSessionRequest(ctx, request, response, sessionId);
  } else if (action === "rename") {
    await renameSession(ctx, request, response, sessionId);
  } else if (action === "archive-preview") {
    await previewArchive(ctx, request, response, sessionId);
  } else if (action === "archive") {
    await archiveSession(ctx, request, response, sessionId);
  } else if (action === "send") {
    await sendInput(ctx, request, response, sessionId);
  } else if (action === "kernel/interrupt") {
    await interruptKernel(ctx, request, response, sessionId);
  } else {
    await cancelOperation(ctx, request, response, sessionId);
  }
}
