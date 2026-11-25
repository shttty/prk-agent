import type { WorkspaceMethod } from "../requests/requests-types.ts";
import { fileMethods } from "./http-routes-constants.ts";

/** New routes remain under the existing private session namespace. Terminal I/O is not HTTP: see `terminalSocketRoute`. */
export function workspaceHttpRoute(pathname: string): { sessionId: string; method: WorkspaceMethod | "filesImage"; verb: "GET" | "POST" } | undefined {
  const parts = pathname.split("/");
  if (parts[1] !== "api" || parts[2] !== "sessions" || !parts[3]) return;
  const sessionId = parts[3];
  if (parts[4] === "files" && parts.length === 6) {
    if (parts[5] === "image") return { sessionId, method: "filesImage", verb: "GET" };
    const method = fileMethods[parts[5]!];
    if (typeof method === "string") return { sessionId, method, verb: "POST" };
  }
  if (parts[4] !== "terminals") return;
  if (parts.length === 5) return { sessionId, method: "terminalsList", verb: "GET" };
  if (parts.length === 6 && parts[5] === "interrupt") return { sessionId, method: "terminalInterrupt", verb: "POST" };
  if (parts.length === 6 && parts[5] === "close") return { sessionId, method: "terminalClose", verb: "POST" };
}
