import { executeNativeAction } from "./execute-native-action.js";
export async function forkMessage(ctx, message) {
    const custom = message?.metadata?.custom;
    if (ctx.state.session.pending.has("nativeActionPending") || message?.role !== "assistant" || !custom?.forkEntryId
      || custom.forkSessionId !== ctx.state.selectedSessionId) return false;
    return executeNativeAction(ctx, "fork-reply", { entryId: custom.forkEntryId });
  }

