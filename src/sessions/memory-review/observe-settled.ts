import { runAgentLoop } from "@earendil-works/pi-agent-core";
import { convertToLlm, type AgentSession } from "@earendil-works/pi-coding-agent";
import type { MemoryChange } from "../memory/memory-types.ts";
import { explicitLayerNames } from "../memory/layers/explicit-layer-names.ts";
import type { MemoryReviewContext } from "./review-types.ts";
import { createMemoryAgentTool } from "./create-agent-tool.ts";
import { reviewPrompt } from "./review-prompt.ts";
import { sendMemoryNotice } from "./send-memory-notice.ts";

/** Counts tool calls and, once a reply settles past either threshold, runs one memory-only review. */
export function observeSettled(ctx: MemoryReviewContext, event: Parameters<Parameters<AgentSession["subscribe"]>[0]>[0]): void {
  if (event.type === "tool_execution_end" && !ctx.closed) { ctx.toolCalls++; return; }
  const { session, modelRuntime, store, scope, thresholds } = ctx;
  if (event.type !== "agent_settled" || event.aborted || ctx.closed || ctx.running) return;
  if (ctx.turns < thresholds.userTurns && ctx.toolCalls < thresholds.toolCalls) return;
  ctx.turns = 0;
  ctx.toolCalls = 0;
  const model = session.model;
  if (!model) return;
  let layers;
  try { layers = store.settings().layers; } catch { return; }
  // Public finalized snapshot, including native system/tool changes and compaction. Never rebuild history.
  const messages = structuredClone(session.messages);
  const controller = new AbortController();
  const changes: MemoryChange[] = [];
  const explicit = explicitLayerNames(store);
  const tool = createMemoryAgentTool(store, { ...scope, source: "review" }, async (result) => {
    changes.push(...result.changes.filter((change) => !explicit.has(change.target)));
    const control = result.changes.filter((change) => explicit.has(change.target));
    if (control.length) await sendMemoryNotice(session, { source: "control", changes: control });
  });
  const completion = runAgentLoop([
    { role: "user", content: reviewPrompt(layers), timestamp: Date.now() },
  ], { messages, tools: [tool] }, {
    model, convertToLlm,
    sessionId: session.sessionManager.getSessionId(),
    ...(session.thinkingLevel === "off" ? {} : { reasoning: session.thinkingLevel }),
  }, (reviewEvent) => {
    if (reviewEvent.type === "message_end" && reviewEvent.message.role === "assistant" && reviewEvent.message.stopReason === "error") {
      console.error(`[${new Date().toISOString()}] Memory review failed for ${scope.sessionId}: ${reviewEvent.message.errorMessage ?? "Model request failed."}`);
    }
  }, controller.signal, (selected, context, options) => modelRuntime.streamSimple(selected, context, options))
    .then(async () => {
      if (changes.length) await sendMemoryNotice(session, { source: "review", changes });
    })
    .catch((error: unknown) => {
      if (!controller.signal.aborted) console.error(`[${new Date().toISOString()}] Memory review failed for ${scope.sessionId}:`, error);
    })
    .finally(() => { ctx.running = undefined; });
  ctx.running = { controller, completion };
}
