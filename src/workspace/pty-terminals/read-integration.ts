import type { ShellIntegrationStatus } from "../terminals/terminals-types.ts";
import type { PtyContext } from "./terminal-state.ts";

export async function readIntegration(ctx: PtyContext, sessionId: string, name: string): Promise<ShellIntegrationStatus> {
  const entry = ctx.sessions.get(sessionId)?.get(name);
  if (!entry || entry.closed) return "unavailable";
  await entry.integrationReady;
  return entry.closed ? "unavailable" : entry.integration;
}
