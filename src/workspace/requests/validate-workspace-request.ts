import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import { keys } from "./has-only-request-fields.ts";
import { identifier } from "./is-identifier.ts";
import { validateRequest } from "../target-files/validate-request.ts";
import { positive } from "./is-positive-count.ts";

export function validateWorkspaceRequest(method: string, p: Record<string, unknown>, limits: LimitsOptions): boolean {
  if (method === "unsubscribeTerminal" || method === "filesDownloadNext") return keys(p, []);
  if (!identifier(p.sessionId, limits.identityChars)) return false;
  if (method === "terminalsList") return keys(p, ["sessionId"]);
  if (method.startsWith("files")) {
    try { validateRequest(method, p, limits); return true; }
    catch { return false; }
  }
  if (!identifier(p.name, limits.identityChars)) return false;
  if (["terminalOpen", "terminalClose", "subscribeTerminal"].includes(method)) return keys(p, ["sessionId", "name"]);
  if (method === "terminalInterrupt") return keys(p, ["sessionId", "name", "generation", "commandId"])
    && identifier(p.generation, limits.identityChars) && identifier(p.commandId, limits.identityChars);
  if (method === "terminalInput") return keys(p, ["sessionId", "name", "data"]) && typeof p.data === "string";
  return method === "terminalResize" && keys(p, ["sessionId", "name", "rows", "cols"]) && positive(p.rows) && positive(p.cols);
}
