import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { IncomingMessage } from "node:http";
import { rejectPathTraversal } from "./reject-path-traversal.ts";
import { HttpError } from "./create-error.ts";
import { nativeRequest } from "./validate-wire-params.ts";
import { routeSessionPath } from "../session-routes/parse-session-route.ts";
import { workspaceHttpRoute } from "../../workspace/http-routes/workspace-http-route.ts";
import { terminalSocketRoute } from "../../workspace/http-routes/terminal-socket-route.ts";
import { parseKernelResultQuery } from "../session-routes/parse-kernel-result-query.ts";

export function routePath(limits: LimitsOptions, request: IncomingMessage, origin: string): URL {
  const rawUrl = request.url ?? "/";
  rejectPathTraversal(rawUrl);
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, origin);
  } catch {
    throw new HttpError(400, "Request URL is invalid.");
  }
  if (parsed.origin !== origin) throw new HttpError(403, "Request URL origin is not allowed.");
  if (parsed.search.length > 0) {
    if (request.method === "GET" && terminalSocketRoute(parsed.pathname)) {
      const generation = parsed.searchParams.get("generation");
      if ([...parsed.searchParams.keys()].length !== 1 || parsed.searchParams.getAll("generation").length !== 1
        || !generation || generation.length > limits.identityChars || /[\x00-\x1f\x7f]/u.test(generation)) {
        throw new HttpError(400, "Terminal route requires a single nonempty generation query.");
      }
      return parsed;
    }
    if (request.method === "POST" && (parsed.pathname === "/api/artifacts/upload"
      || workspaceHttpRoute(parsed.pathname)?.method === "filesUpload")) return parsed;
    if (request.method === "GET" && parsed.pathname === "/api/capabilities"
      && [...parsed.searchParams.keys()].length === 1 && parsed.searchParams.has("instance")) {
      nativeRequest(limits, { instance: parsed.searchParams.get("instance") }, "capabilitiesList");
      return parsed;
    }
    if (request.method === "GET" && workspaceHttpRoute(parsed.pathname)?.method === "filesImage") return parsed;
    const route = routeSessionPath(limits, parsed.pathname);
    if (request.method === "GET" && (route?.action === "history-page" || route?.action === "prompt/messages")) return parsed;
    if (request.method === "GET" && route?.action === "tool-content") {
      if ([...parsed.searchParams.keys()].length !== 1 || parsed.searchParams.getAll("toolCallId").length !== 1) {
        throw new HttpError(400, "Tool content requires exactly one toolCallId query parameter.");
      }
      nativeRequest(limits, { toolCallId: parsed.searchParams.get("toolCallId") }, "toolContent", route.sessionId);
      return parsed;
    }
    if (request.method === "GET" && route?.action === "kernel/result") {
      parseKernelResultQuery(limits, parsed, route.sessionId);
      return parsed;
    }
    throw new HttpError(400, "Unsupported or repeated query parameters for this endpoint.");
  }
  return parsed;
}
