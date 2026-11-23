import { registerTool } from "../../registration/register-tool.mjs";
import { on } from "../../registration/register-event-handler.mjs";
import { registerCommand } from "../../registration/register-command.mjs";
import { readableActions } from "../../sdk-context/create-context.mjs";
import { executeCommand } from "../../command-process/execute-command.mjs";
import { ignoredRenderer } from "./warn-renderer.mjs";
import { applyProviderPolicy } from "../../registration/apply-provider-policy.mjs";

export function registrationApi(ctx, owner, pkg, path = pkg.name) {
  return ctx.facade(owner, "pi", {
    events: owner.events,
    registerTool: registerTool.bind(undefined, ctx, owner, pkg),
    on: on.bind(undefined, ctx, owner, pkg),
    registerCommand: registerCommand.bind(undefined, ctx, owner, pkg),
    registerProvider: (providerId) => { applyProviderPolicy(ctx, owner, pkg, path, "register", providerId); },
    unregisterProvider: (providerId) => { applyProviderPolicy(ctx, owner, pkg, path, "unregister", providerId); },
    registerToolRenderer: ignoredRenderer.bind(undefined, ctx, owner, "registerToolRenderer"),
    registerMessageRenderer: ignoredRenderer.bind(undefined, ctx, owner, "registerMessageRenderer"),
    registerEntryRenderer: ignoredRenderer.bind(undefined, ctx, owner, "registerEntryRenderer"),
    registerMarkdownTransformer: ignoredRenderer.bind(undefined, ctx, owner, "registerMarkdownTransformer"),
    exec: executeCommand.bind(undefined, ctx, owner),
    ...readableActions(ctx, owner),
  });
}
