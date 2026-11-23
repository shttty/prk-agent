import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { DEFAULT_SESSION_OPTIONS, type SessionOptions } from "../../config/session/session-options.ts";
import { latestAssistantFailure } from "./assistant-history/find-latest-assistant-failure.ts";
import { firstLine } from "./details/read-first-line.ts";

/** Original-TUI-level user error, enriched only when its transport text is otherwise useless. */
export function summarizeSessionFailure(session: Pick<AgentSession, "messages">, fallback: string, after = 0, options: SessionOptions = DEFAULT_SESSION_OPTIONS): string {
  const message = latestAssistantFailure(session, after, options);
  if (!message) return `执行失败：${firstLine(fallback) || "未知错误"}`;
  const reason = (message.errorMessage?.trim() || firstLine(fallback) || "未知错误").replace(/\s+/g, " ");
  const diagnostic = message.diagnostics?.find((entry) => entry.type === "provider_transport_failure");
  const genericTransportError = /^(?:WebSocket error|fetch failed|network error)$/i.test(reason);
  if (diagnostic || genericTransportError) {
    const rawTransport = typeof diagnostic?.details?.configuredTransport === "string"
      ? diagnostic.details.configuredTransport.trim()
      : genericTransportError && /^WebSocket/i.test(reason) ? "websocket" : "";
    const transport = rawTransport.toLowerCase() === "websocket" ? "WebSocket"
      : rawTransport.toLowerCase() === "sse" ? "SSE"
      : rawTransport.toLowerCase() === "http" ? "HTTP"
      : rawTransport;
    const rawPhase = typeof diagnostic?.details?.phase === "string" ? diagnostic.details.phase.trim() : "";
    const phase = rawPhase === "connect" ? "连接" : rawPhase === "open" ? "握手"
      : rawPhase === "send" ? "发送" : rawPhase === "receive" ? "接收" : rawPhase;
    const context = [transport, phase ? `${phase}阶段` : ""].filter(Boolean).join(" ");
    return `模型服务连接失败${context ? `（${context}）` : ""}：${reason}`;
  }
  return `模型请求失败：${reason}`;
}
