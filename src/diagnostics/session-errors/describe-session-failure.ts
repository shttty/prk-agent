import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { DEFAULT_SESSION_OPTIONS, type SessionOptions } from "../../config/session/session-options.ts";
import { latestAssistantFailure } from "./assistant-history/find-latest-assistant-failure.ts";
import { stackFrames } from "./details/read-error-stack-frames.ts";
import { jsonDetail } from "./details/format-error-json-detail.ts";

/** Detailed Pi provider context for Gateway logs, never for the Web status line. */
export function describeSessionFailure(session: Pick<AgentSession, "messages">, base?: string, after = 0, options: SessionOptions = DEFAULT_SESSION_OPTIONS): string | undefined {
  const message = latestAssistantFailure(session, after, options);
  if (!message) return undefined;
  const api = typeof message.api === "string" && message.api ? ` · api: ${message.api}` : "";
  const lines: string[] = [`model: ${message.provider}/${message.model}${api}`];
  const errorMessage = typeof message.errorMessage === "string" ? message.errorMessage.trim() : "";
  if (errorMessage && !(base ?? "").includes(errorMessage)) lines.push(errorMessage);
  for (const entry of message.diagnostics ?? []) {
    const stamp = Number.isFinite(entry.timestamp) ? new Date(entry.timestamp).toISOString() : undefined;
    lines.push(`${entry.type || "diagnostic"}${stamp ? ` @ ${stamp}` : ""}`);
    if (entry.error) {
      const headline = `${entry.error.name || "Error"}: ${entry.error.message}`;
      lines.push(headline, ...stackFrames(entry.error.stack, headline, options.errorStackLines));
      if (entry.error.code !== undefined) lines.push(`code: ${entry.error.code}`);
    }
    if (entry.details !== undefined) lines.push(`details: ${jsonDetail(entry.details)}`);
  }
  return lines.join("\n");
}
