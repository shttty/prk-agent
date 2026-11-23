import type { RuntimeContext } from "../runtime-state.ts";
import type { ConversationContext } from "../runtime-state.ts";
import type { ExtensionHandlerScope } from "../../extension-invocation/invocation-types.ts";
import { projectExtensionDeclarations } from "../tools/project-extension-declarations.ts";

export function extensionsOverride(ctx: RuntimeContext, conversation: ConversationContext, base: Parameters<ExtensionHandlerScope["override"]>[0]) {
  return conversation.extensionHandlers.override(base, (loaded) => projectExtensionDeclarations(ctx, loaded));
}
