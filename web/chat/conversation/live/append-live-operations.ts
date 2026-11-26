import { safeText } from "../../../workbench/payloads/safe-text.js";
import { trimDisplay } from "../messages/trim-display.ts";
import { makeAssistantMessage } from "../messages/make-assistant-message.ts";
import { toolPart } from "../tools/tool-part.ts";
import { startedAtValue } from "../tools/started-at-value.ts";
import { thinkingPart } from "../messages/thinking-part.ts";
import { hiddenThinkingLabel } from "../messages/hidden-thinking-label.ts";
import type { StreamSegment } from "../../../workbench/store/store-types.ts";
import type { ConversationState, MessagePart, MessageStatus, ToolRecord, TranscriptMessage } from "../conversation-types.ts";

type OperationTurn = { segments: StreamSegment[]; tools: { key: string; record: ToolRecord }[] };

/**
 * One live assistant turn per operation. Text and thinking segments carry how many tool runs
 * of that operation had started when the segment began, so they and tool rows
 * interleave in arrival order. Tools already placed by the snapshot are skipped
 * but still counted, which keeps segment positions stable after a refresh.
 */
export function appendLiveOperations(output: TranscriptMessage[], state: ConversationState, runs: Map<string, ToolRecord>, placedTools: Set<string>) {
  const operations = new Map<string, OperationTurn>();
  const entry = (operationId: string): OperationTurn => {
    const existing = operations.get(operationId);
    if (existing) return existing;
    const created: OperationTurn = { segments: [], tools: [] };
    operations.set(operationId, created);
    return created;
  };
  for (const [operationId, segments] of state.session.streams) {
    entry(operationId).segments = segments.filter((segment) => safeText(segment.text));
  }
  for (const [key, record] of runs) {
    if (!record.run) continue;
    entry(safeText(record.run.operationId) || "live").tools.push({ key, record });
  }
  const label = hiddenThinkingLabel(state);
  for (const [operationId, { segments, tools }] of operations) {
    const streaming = state.session.extensionUiRender?.streaming;
    const transformed = streaming?.operationId === operationId ? safeText(streaming.text) : "";
    let displaySegments = segments;
    if (transformed) {
      // A plugin message renderer rewrites the reply text only; thinking segments keep their place.
      const textSegments = segments.filter((segment) => segment.part !== "thinking");
      const raw = textSegments.map((segment) => segment.text).join("");
      if (transformed.startsWith(raw) && textSegments.length) {
        const last = textSegments.at(-1);
        displaySegments = segments.map((segment) => segment === last ? { ...segment, text: `${segment.text}${transformed.slice(raw.length)}` } : segment);
      } else if (!tools.length) {
        displaySegments = [...segments.filter((segment) => segment.part === "thinking"), { afterTools: 0, text: transformed }];
      }
    }
    const ordered = tools.map((tool, index) => ({ ...tool, index })).sort((left, right) => {
      const delta = startedAtValue(left.record) - startedAtValue(right.record);
      return Number.isFinite(delta) && delta !== 0 ? delta : left.index - right.index;
    });
    const parts: MessagePart[] = [];
    let cursor = 0;
    let running = false;
    const emitTools = (limit: number) => {
      for (let next = ordered[cursor]; next && cursor < limit; next = ordered[cursor]) {
        cursor += 1;
        if (placedTools.has(next.key)) continue;
        if (!next.record.run?.ended) running = true;
        parts.push(toolPart(next.record.call, next.record.result, next.record.run));
      }
    };
    for (const segment of displaySegments) {
      emitTools(Number(segment.afterTools) || 0);
      const part = segment.part === "thinking" ? thinkingPart(segment.text, label) : { type: "text" as const, text: trimDisplay(segment.text) };
      if (part) parts.push(part);
    }
    emitTools(Number.POSITIVE_INFINITY);
    if (!parts.length) continue;
    const completed = Boolean(state.session.operations.get(operationId)?.completion);
    const status: MessageStatus = !completed || running ? { type: "running" } : { type: "complete", reason: "stop" };
    output.push(makeAssistantMessage(parts, `live-${operationId}`, new Date(), status, { live: true, operationId }));
  }
}
