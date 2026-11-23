import { discoverTargetResources } from "../../target-resources/discover.ts";
import { DEFAULT_LIMITS_OPTIONS } from "../../../config/limits/limits-options.ts";
import { remoteExtensionFingerprint } from "../../../remote-extensions/packages/fingerprint-packages.ts";
import { remoteConfiguration } from "../configuration/read-remote-config.ts";
import { scopeContext } from "../configuration/read-scope.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import type { ConversationContext } from "../runtime-state.ts";
import { refreshRegistration } from "./registration/refresh-registration.ts";

export async function discoverResources(ctx: RuntimeContext, conversation: ConversationContext): Promise<void> {
  await ctx.remoteLoad?.close();
  ctx.remoteLoad = undefined;
  conversation.remote = remoteConfiguration(ctx);
  ctx.loadedRemote = remoteExtensionFingerprint(conversation.remote.packages);
  await ctx.skillLease?.release();
  ctx.skillLease = undefined;
  ctx.targetSkills = { directories: [], skills: [], diagnostics: [] };
  ctx.sharedPaths = new Set(ctx.sessionOptions.noSkills ? [] : ctx.dependencies.skillLibrary?.paths(scopeContext(ctx)) ?? []);
  ctx.targetResources = undefined;
  const lease = ctx.channels.acquire(ctx.target.id);
  try {
    ctx.targetResources = await discoverTargetResources(lease, ctx.cwd, ctx.dependencies.agentDir,
      ctx.dependencies.limits ?? DEFAULT_LIMITS_OPTIONS, ctx.sessionOptions,
      ctx.dependencies.remoteExtensionOptions?.store, ctx.dependencies.remoteExtensionOptions?.hostOptions?.runtime,
      ctx.codemodeOptions.binChunkBytes);
    ctx.targetSkills = ctx.targetResources.skills;
    ctx.skillLease = lease;
    await refreshRegistration(ctx);
    ctx.loadedRemoteRegistration = ctx.currentRemoteRegistration;
    for (const diagnostic of ctx.targetSkills.diagnostics) console.error(`[skills] ${ctx.target.id} ${diagnostic.path}: ${diagnostic.message.replace(/\s+/gu, " ").trim()}`);
  } catch (error) {
    await lease.release().catch(() => undefined);
    throw error;
  }
}
