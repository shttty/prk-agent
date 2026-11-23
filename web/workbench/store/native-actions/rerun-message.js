import { executeNativeAction } from "./execute-native-action.js";
import { setDraft } from "../drafts/set-draft.js";
import { sendMessage } from "../messages/send-message.js";
export async function rerunMessage(ctx, message, { mode, destination }) {
    const custom = message?.metadata?.custom;
    if (ctx.state.session.pending.has("nativeActionPending") || message?.role !== "user" || !custom?.entryId || typeof custom.rerunText !== "string"
      || custom.entrySessionId !== ctx.state.selectedSessionId || !["retry", "edit"].includes(mode)) return false;
    let moved;
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

