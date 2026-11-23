import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { bindHostedExtensions } from "../../host/bind-extensions.ts";
import { createSessionHost } from "../../host/assemble-host.ts";
import { createHostedExtensionUI } from "../../extension-ui/assemble-extension-ui.ts";
import { createMemoryReview } from "../../memory-review/assemble-memory-review.ts";
import { applyToolLoadout } from "../tools/apply-loadout.ts";
import { actualCapabilityCatalog } from "../capabilities/get-actual-catalog.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import type { ConversationContext } from "../runtime-state.ts";
import { disposeConversation } from "../lifecycle/dispose-conversation.ts";
import type { RuntimeConversation } from "../runtime-types.ts";
import { registrationFileVersions } from "../resources/registration/read-file-versions.ts";

export async function attachHost(ctx: RuntimeContext, conversation: ConversationContext, session: AgentSession): Promise<RuntimeConversation> {
const extensionUi = await createHostedExtensionUI(session, ctx.dependencies.agentDir);
ctx.hostedUi = extensionUi;
const review = reviewSettings(ctx);
if (ctx.memoryStore && ctx.memoryOptions.review && review?.enabled) {
  const project = ctx.dependencies.projectId?.();
  ctx.memoryReview = createMemoryReview(session, ctx.dependencies.modelRuntime, ctx.memoryStore, { sessionId: ctx.sessionManager.getSessionId(), instance: ctx.target.id, ...(project === undefined ? {} : { project }) }, review);
}
conversation.host = createSessionHost({
        session,
        extensionUi,
        extensionHandlers: conversation.extensionHandlers,
        sessionOptions: ctx.dependencies.sessionOptions,
        kernel: ctx.python,
        terminals: ctx.modelTerminals,
        dispose: disposeConversation.bind(undefined, ctx, conversation),
      });
await bindHostedExtensions(session, conversation.host, extensionUi);
ctx.registrationFiles = registrationFileVersions(ctx);
applyToolLoadout(ctx, session);
ctx.dependencies.onCapabilityCatalog?.(actualCapabilityCatalog(ctx));
if (conversation.persisted.toolMode === undefined) ctx.sessionManager.appendCustomEntry("gateway-native-session-state", { version: 1, toolMode: ctx.toolMode });
if (conversation.persisted.delegation === undefined) ctx.sessionManager.appendCustomEntry("gateway-native-session-state", { version: 1, delegation: ctx.delegation });
return { session, host: conversation.host, extensionUi, loadedProject: conversation.loadedProject };
}

// A misconfigured store disables review with memory itself; the store already logged why.
function reviewSettings(ctx: RuntimeContext) {
  try { return ctx.memoryStore?.settings().review; } catch { return undefined; }
}
