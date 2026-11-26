import type { ListenerContext } from "../listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { API_HEADERS } from "../../request/response-constants.ts";
import { HttpError } from "../../request/create-error.ts";
import { enforceBodyDeadline } from "./enforce-body-deadline.ts";
import { routePath } from "../../request/parse-request-url.ts";
import { validateBrowserRequest } from "../validate-browser-request.ts";
import { handleArtifactRequest } from "../../artifact-routes/handle-artifact-request.ts";
import { handlePackageRequest } from "../../remote-package-routes/handle-package-request.ts";
import { readWorkbench } from "../../workbench-routes/read-workbench.ts";
import { readUiSettings } from "../../workbench-routes/read-ui-settings.ts";
import { handleRestartRequest } from "../../gateway-restart/handle-restart-request.ts";
import { listModels } from "../../workbench-routes/list-models.ts";
import { handleCapabilityRequest } from "../../capability-routes/handle-capability-request.ts";
import { refreshCapabilities } from "../../capability-routes/refresh-capabilities.ts";
import { reloadInstances } from "../../instance-routes/reload-instances.ts";
import { inspectInstance } from "../../instance-routes/inspect-instance.ts";
import { browseInstance } from "../../instance-routes/browse-instance.ts";
import { addInstance } from "../../instance-routes/add-instance.ts";
import { routeTargetPath } from "../../instance-routes/parse-instance-route.ts";
import { handleInstanceRequest } from "../../instance-routes/handle-instance-request.ts";
import { handleEnvironmentRequest } from "../../instance-routes/handle-environment-request.ts";
import { streamWorkbench } from "../../observations/stream-workbench.ts";
import { createSession } from "../../session-routes/create-session.ts";
import { routeCodeModePath } from "../../resource-routes/parse-resource-route.ts";
import { handleResourceRequest } from "../../resource-routes/handle-resource-request.ts";
import { workspaceHttpRoute } from "../../../workspace/http-routes/workspace-http-route.ts";
import { handleWorkspaceRequest } from "../../workspace-routes/handle-workspace-request.ts";
import { dispatchArchiveRequest } from "../../archive-routes/dispatch-archive-request.ts";
import { handleSessionRequest } from "../../session-routes/handle-session-request.ts";
import { handleSessionControlRequest } from "../../session-control-routes/handle-session-control-request.ts";
import { handleDerivationRequest } from "../../derivation-routes/handle-derivation-request.ts";
import { handleKernelExecutionRequest } from "../../kernel-execution-routes/handle-kernel-execution-request.ts";
import { handleToolTitleRequest } from "../../tool-title-routes/handle-tool-title-request.ts";
import { handleSoulRequest } from "../../soul-routes/handle-soul-request.ts";

export async function handleRequest(ctx: ListenerContext, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const { limits } = ctx;
    for (const [key, value] of Object.entries(API_HEADERS)) response.setHeader(key, value);
    if (ctx.stopping) throw new HttpError(503, "Web service is shutting down.");
    const url = routePath(limits, request, ctx.origin);
    const path = url.pathname;
    const mutation = request.method === "POST" || request.method === "PATCH" || request.method === "DELETE";
    validateBrowserRequest(ctx, request, mutation);
    const workspaceRoute = workspaceHttpRoute(path);
    const streamingUpload = request.method === "POST" && (path === "/api/artifacts/upload" || workspaceRoute?.method === "filesUpload");
    if (!streamingUpload) enforceBodyDeadline(ctx.http, request, response);

    if (path === "/api/session-control/root" || path === "/api/session-control/supervisor") {
      await handleSessionControlRequest(ctx, request, response, url);
      return;
    }
    if (["/api/artifacts", "/api/artifacts/upload", "/api/artifacts/current", "/api/artifacts/delete"].includes(path)) {
      await handleArtifactRequest(ctx, request, response, url, path);
      return;
    }


    if (["/api/plugins", "/api/plugins/install", "/api/plugins/change", "/api/plugins/uninstall"].includes(path)) {
      await handlePackageRequest(ctx, request, response, url, path);
      return;
    }

    if (path === "/api/workbench") {
      await readWorkbench(ctx, request, response);
      return;
    }
    if (path === "/api/ui") {
      await readUiSettings(ctx, request, response);
      return;
    }
    // Deliberately not forwarded to the Gateway: it must work while the Gateway is frozen.
    if (path === "/api/gateway/restart") {
      await handleRestartRequest(ctx, request, response);
      return;
    }
  if (path === "/api/models") {
      await listModels(ctx, request, response);
      return;
    }
    if (path === "/api/capabilities") {
      await handleCapabilityRequest(ctx, request, response, url);
      return;
    }
    if (path === "/api/derivation") {
      await handleDerivationRequest(ctx, request, response);
      return;
    }
    if (path === "/api/settings/kernel-execution") {
      await handleKernelExecutionRequest(ctx, request, response);
      return;
    }
    if (path === "/api/settings/tool-title") {
      await handleToolTitleRequest(ctx, request, response);
      return;
    }
    if (path === "/api/settings/soul") {
      await handleSoulRequest(ctx, request, response);
      return;
    }
    if (path === "/api/capabilities/refresh") {
      await refreshCapabilities(ctx, request, response);
      return;
    }
    if (path === "/api/targets/reload") {
      await reloadInstances(ctx, request, response);
      return;
    }
    if (path === "/api/targets/inspect") {
      await inspectInstance(ctx, request, response);
      return;
    }
    if (path === "/api/targets/browse") {
      await browseInstance(ctx, request, response);
      return;
    }
    if (path === "/api/targets") {
      await addInstance(ctx, request, response);
      return;
    }
    if (path.startsWith("/api/targets/") && path.endsWith("/environment")) {
      const target = routeTargetPath(limits, path.slice(0, -"/environment".length));
      if (target === undefined) throw new HttpError(404, "Endpoint not found.");
      await handleEnvironmentRequest(ctx, request, response, target);
      return;
    }

    const targetName = routeTargetPath(limits, path);
    if (targetName !== undefined) {
      await handleInstanceRequest(ctx, request, response, targetName);
      return;
    }

    if (path === "/api/sessions/events") {
      await streamWorkbench(ctx, request, response);
      return;
    }

    if (path === "/api/sessions") {
      await createSession(ctx, request, response);
      return;
    }

    const codeModeRoute = routeCodeModePath(limits, path);
    if (codeModeRoute) {
      await handleResourceRequest(ctx, request, response, codeModeRoute);
      return;
    }

    if (workspaceRoute) {
      await handleWorkspaceRequest(ctx, request, response, workspaceRoute, url.searchParams);
      return;
    }

    if ((path.startsWith("/api/projects/") || path.startsWith("/api/archive/"))
      && await dispatchArchiveRequest(ctx, request, response, path)) return;

    await handleSessionRequest(ctx, request, response, url);
  }