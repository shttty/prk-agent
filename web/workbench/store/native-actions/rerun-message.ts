import type { StoreContext } from "../store-context-types.ts";
import type { NativeMessageRef } from "./native-action-types.ts";
import { executeNativeAction } from "./execute-native-action.ts";
import { setDraft } from "../drafts/set-draft.ts";
import { sendMessage } from "../messages/send-message.ts";

export async function rerunMessage(ctx: StoreContext, message: NativeMessageRef, { mode, destination }: { mode: "retry" | "edit"; destination?: "new" }): Promise<boolean> {
  const custom = message.metadata?.custom;
  if (ctx.state.session.pending.has("nativeActionPending") || message.role !== "user" || !custom?.entryId || typeof custom.rerunText !== "string"
    || custom.entrySessionId !== ctx.state.selectedSessionId) return false;
  let moved: boolean;
  if (destination === "new") {
    if (!custom.forkBeforeEntryId) return false;
    moved = await executeNativeAction(ctx, "fork-reply", { entryId: custom.forkBeforeEntryId }, { transcript: false });
  } else {
    moved = await executeNativeAction(ctx, "tree", { entryId: custom.entryId }, { transcript: false });
  }
  if (!moved) return false;
  if (mode === "edit") {
    setDraft(ctx, custom.rerunText);
    return true;
  }
  return sendMessage(ctx, custom.rerunText, { attachments: [], references: [] });
}
