import type { RuntimeContext } from "../runtime-state.ts";
import type { ConversationContext } from "../runtime-state.ts";

export async function disposeConversation(ctx: RuntimeContext, conversation: ConversationContext) : Promise<void> {
          ctx.terminalEvents?.dispose(); ctx.terminalEvents = undefined;
          const failures: unknown[] = [];
          // Remote shutdown may call the public UI context; finish it before SDK disposal invalidates ctx.
          for (const cleanup of [() => ctx.python.prepareHandoff(), () => ctx.memoryReview?.close(), () => ctx.remoteLoad?.close(), () => conversation.dispose(), () => ctx.disposeLibrary?.dispose()]) {
            try { await cleanup(); } catch (error) { failures.push(error); }
          }
          if (failures.length) throw new AggregateError(failures, "Session runtime disposal failed.");
        }
