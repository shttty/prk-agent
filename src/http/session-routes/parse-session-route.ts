import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import { HttpError } from "../request/create-error.ts";
import { decodeRouteIdentity } from "../request/decode-route-identity.ts";

export function routeSessionPath(limits: LimitsOptions, pathname: string): { sessionId: string; action?: string } | undefined {
  const prefix = "/api/sessions/";
  if (!pathname.startsWith(prefix)) return undefined;
  const rest = pathname.slice(prefix.length);
  const separator = rest.indexOf("/");
  const rawSessionId = separator < 0 ? rest : rest.slice(0, separator);
  const action = separator < 0 ? undefined : rest.slice(separator + 1);
  if (rawSessionId.length === 0) throw new HttpError(404, "Endpoint not found.");
  if (action !== undefined && !["events", "send", "send-status", "cancel", "kernel/interrupt", "kernel/result", "history", "history-page", "tool-content", "native", "rename", "archive", "archive-preview", "recover", "wake", "project", "manage"].includes(action)) {
    throw new HttpError(404, "Endpoint not found.");
  }
  return { sessionId: decodeRouteIdentity(limits, rawSessionId), ...(action === undefined ? {} : { action }) };
}
