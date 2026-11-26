import type { StoreContext } from "../store-context-types.ts";
import type { NativeMessageRef } from "./native-action-types.ts";
import { executeNativeAction } from "./execute-native-action.ts";

export async function forkMessage(ctx: StoreContext, message: NativeMessageRef): Promise<boolean> {
  const custom = message.metadata?.custom;
  if (message.role !== "assistant" || !custom?.forkEntryId || custom.forkSessionId !== ctx.state.selectedSessionId) return false;
  return executeNativeAction(ctx, "fork-reply", { entryId: custom.forkEntryId });
}
