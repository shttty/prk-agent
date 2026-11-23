import { safeText } from "../../../workbench/payloads/safe-text.js";
import { trimDisplay } from "../messages/trim-display.js";
import { makeAssistantMessage } from "../messages/make-assistant-message.js";
import { toolPart } from "../tools/tool-part.js";
import { startedAtValue } from "../tools/started-at-value.js";
import { thinkingPart } from "../messages/thinking-part.js";
import { hiddenThinkingLabel } from "../messages/hidden-thinking-label.js";
/**
 * One live assistant turn per operation. Text and thinking segments carry how many tool runs
 * of that operation had started when the segment began, so they and tool rows
 * interleave in arrival order. Tools already placed by the snapshot are skipped
 * but still counted, which keeps segment positions stable after a refresh.
 */
export function appendLiveOperations(output, state, runs, placedTools) {
  const operations = new Map();
  const entry = (operationId) => {
    if (!operations.has(operationId)) operations.set(operationId, { segments: [], tools: [] });
    return operations.get(operationId);
  };
  for (const [operationId, segments] of state.session.streams) {
    entry(operationId).segments = segments.filter((segment) => safeText(segment.text));
  }
  for (const [key, record] of runs) {
    if (!record?.run) continue;
    entry(safeText(record.run.operationId) || "live").tools.push({ key, record });
  }
  const label = hiddenThinkingLabel(state);
  for (const [operationId, { segments, tools }] of operations) {
    const transformed = state.session.extensionUiRender?.streaming?.operationId === operationId ? safeText(state.session.extensionUiRender.streaming.text) : "";
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
    const parts = [];
    let cursor = 0;
    let running = false;
    const emitTools = (limit) => {
      while (cursor < ordered.length && cursor < limit) {
        const { key, record } = ordered[cursor];
        cursor += 1;
        if (placedTools.has(key)) continue;
        if (!record.run?.ended) running = true;
        parts.push(toolPart(record.call, record.result, record.run));
      }
    };
    for (const segment of displaySegments) {
      emitTools(Number(segment.afterTools) || 0);
      const part = segment.part === "thinking" ? thinkingPart(segment.text, label) : { type: "text", text: trimDisplay(segment.text) };
      if (part) parts.push(part);
    }
    emitTools(Number.POSITIVE_INFINITY);
    if (!parts.length) continue;
    const completed = Boolean(state.session.operations.get(operationId)?.completion);
    const status = !completed || running ? { type: "running" } : { type: "complete", reason: "stop" };
    output.push(makeAssistantMessage(parts, `live-${operationId}`, new Date(), status, { live: true, operationId }));
  }
}
