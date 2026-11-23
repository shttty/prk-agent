import type { UiContext } from "./ui-types.ts";
import { editorChanged } from "./editor/change-text.ts";
import { render } from "./messages/build-client-view.ts";
import { releaseClient } from "./lifecycle/release-client.ts";
import { answerDialog } from "./dialogs/answer-dialog.ts";
import { actComponent } from "./components/act-component.ts";
import { complete } from "./autocomplete/complete.ts";

export async function action(ctx: UiContext, args: Record<string, unknown>): Promise<unknown> {
    const operation = args.operation;
    if (operation === "render") return render(ctx, Number(args.width), Number(args.height), typeof args.clientId === "string" ? args.clientId : "default", Array.isArray(args.expandedToolCallIds) ? args.expandedToolCallIds.filter((id): id is string => typeof id === "string") : [], typeof args.operationId === "string" ? args.operationId : undefined, typeof args.historyStart === "string" ? args.historyStart : undefined);
    if (operation === "release-client" && typeof args.clientId === "string") { releaseClient(ctx, args.clientId); return { status: "completed" }; }
    if (operation === "dialog" && typeof args.id === "string") return answerDialog(ctx, args, args.id);
    if (operation === "custom-cancel" && typeof args.id === "string") { if (!ctx.custom || ctx.custom.id !== args.id) return { status: "unavailable", message: "Custom UI is no longer active." }; ctx.custom.done(undefined); ctx.custom = undefined; return { status: "cancelled" }; }
    if (operation === "editor" && typeof args.text === "string") { editorChanged(ctx, args.text, typeof args.clientId === "string" ? args.clientId : undefined); return { status: "completed" }; }
    if (operation === "component" && typeof args.nodeId === "string") return actComponent(ctx, args, args.nodeId);
    if (operation === "autocomplete") return complete(ctx, args);
    if (operation === "completion" || operation === "shortcut") return { status: "unavailable", message: `Extension UI operation ${String(operation)} is unavailable without a public web input bridge.` };
    return { status: "unavailable", message: "Unsupported extension UI operation." };
  }
