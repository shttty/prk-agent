import type { StoreContext } from "../store-context-types.ts";
import { patch } from "../updates/patch.ts";
import { mergeEntry } from "../updates/merge-entry.ts";
import { persistCurrentSession } from "./persist-current-session.ts";

/** Put inputs a stopped operation never read back into the composer; `returnedMessages` is the Gateway's list of their texts. */
export function restoreReturnedMessages(ctx: StoreContext, operationId: string | undefined, returnedMessages: unknown, sessionId: string | null = ctx.state.selectedSessionId) {
  if (!Array.isArray(returnedMessages) || !returnedMessages.length || ctx.state.selectedSessionId !== sessionId) return;
  const returned = returnedMessages.filter((message): message is string => typeof message === "string");
  if (!operationId) {
    patch(ctx, { draft: [ctx.state.draft, ...returned].filter(Boolean).join("\n\n"), session: { ...ctx.state.session, restoredDraft: { count: returned.length } } });
    persistCurrentSession(ctx);
    return;
  }
  const restoredQueueCount = ctx.state.session.operations.get(operationId)?.restoredQueueCount || 0;
  const messages = returned.slice(restoredQueueCount);
  if (!messages.length) return;
  // Returned inputs were never read by the agent: drop their local send receipts so they don't read as "result unknown".
  const unclaimed = [...messages];
  const localMessages = new Map([...ctx.state.session.localMessages].filter(([, entry]) => {
    if (entry.operationId !== operationId) return true;
    const index = unclaimed.indexOf(entry.text);
    if (index < 0) return true;
    unclaimed.splice(index, 1);
    return false;
  }));
  const previousCount = ctx.state.session.restoredDraft?.operationId === operationId ? ctx.state.session.restoredDraft.count : 0;
  patch(ctx, { draft: [ctx.state.draft, ...messages].filter(Boolean).join("\n\n"), session: { ...ctx.state.session, localMessages, operations: mergeEntry(ctx.state.session.operations, operationId, { restoredQueueCount: returned.length }), restoredDraft: { operationId, count: messages.length + previousCount } } });
  persistCurrentSession(ctx);
}
