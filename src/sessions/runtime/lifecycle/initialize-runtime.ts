import { createTargetEnvironments } from "../../../target-environment/connection/assemble-environments.ts";
import { requireConfigured } from "../../../config/execution-target/require-configured.ts";
import { homedir } from "node:os";
import { dirname } from "node:path";
import { resolve } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { readNativeSessionState } from "../../history/read-native-session-state.ts";
import { DEFAULT_SESSION_OPTIONS } from "../../../config/session/session-options.ts";
import { createNativeToolDefinitions } from "../../native-coding/create-native-tool-definitions.ts";
import { discoverKernelToolCatalog } from "../../../codemode/module-catalog/discover-kernel-tool-catalog.ts";
import { DEFAULT_CODEMODE_OPTIONS } from "../../../config/codemode/codemode-options.ts";
import { DEFAULT_LEARNING_OPTIONS } from "../../../config/learning/learning-options.ts";
import { DEFAULT_MEMORY_OPTIONS } from "../../../config/memory/memory-options.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import { createPythonClient } from "../kernel/create-python-client.ts";
import { createRuntimeChannels } from "../resources/create-target-channels.ts";
import { resourceDefaults } from "../resources/create-resource-defaults.ts";
import { createTargetFileTools } from "../../target-files/create-tools.ts";
import { resolvePythonRuntime } from "../../../target-environment/python/resolve-python-runtime.ts";

export async function initializeRuntime(ctx: RuntimeContext): Promise<void> {
  ctx.sessionOptions = ctx.dependencies.sessionOptions ?? DEFAULT_SESSION_OPTIONS;
  ctx.learningOptions = ctx.dependencies.learningOptions ?? DEFAULT_LEARNING_OPTIONS;
  ctx.memoryOptions = ctx.dependencies.memoryOptions ?? DEFAULT_MEMORY_OPTIONS;
  ctx.memoryStore = ctx.memoryOptions.enabled ? ctx.dependencies.memoryStore : undefined;
  ctx.memoryReview = undefined;
  ctx.terminalEvents = undefined;
  ctx.cwd = ctx.target.kernel.cwd;
  if (!ctx.dependencies.model) throw new Error("Session requires an explicit model.");
  ctx.sessionManager = ctx.dependencies.sessionManager ?? SessionManager.inMemory(ctx.cwd);
  requireConfigured(ctx.target);
  await ctx.dependencies.requireEnvironment?.(ctx.target.id);
  ctx.environments = ctx.dependencies.targetEnvironments ?? createTargetEnvironments({
    targetCacheRoot: ctx.dependencies.targetCacheRoot,
    resolve: () => ctx.target.local ? { local: true } : { local: false, command: ctx.target.sshCommand! },
  });
  if (ctx.target.python) {
    ctx.pythonRuntime = { python: ctx.target.python, basePython: ctx.target.python, env: ctx.dependencies.pythonEnvironment?.(ctx.target) ?? {} };
  } else {
    const environment = await ctx.environments.acquire(ctx.target.id);
    try { ctx.pythonRuntime = await resolvePythonRuntime(environment, ctx.target, ctx.dependencies.targetCacheRoot, ctx.dependencies.pythonEnvironment); }
    finally { await environment.release(); }
  }
  ctx.modelTerminals = ctx.dependencies.modelTerminals?.({ target: ctx.target.id, sessionId: ctx.sessionManager.getSessionId(), cwd: ctx.cwd });
  ctx.nativeState = readNativeSessionState(ctx.sessionManager, ctx.dependencies.limits);
  ctx.toolMode = ctx.nativeState.toolMode ?? ctx.sessionOptions.workerTools;
  ctx.delegation = ctx.nativeState.delegation ?? ctx.sessionOptions.delegation;
  ctx.localOverride = ctx.nativeState.localTools;
  ctx.capabilityOverrides = { ...ctx.nativeState.capabilities };
  ctx.toolInventory = [];
  ctx.callbackSession = undefined;
  ctx.unfilteredLoader = undefined;
  ctx.registrationFiles = new Map();
  ctx.targetSkills = { directories: [], skills: [], diagnostics: [] };
  ctx.targetResources = undefined;
  ctx.skillLease = undefined;
  ctx.fileLease = undefined;
  ctx.sharedPaths = new Set<string>();
  ctx.remoteLoad = undefined;
  ctx.loadedRemote = "";
  ctx.loadedRemoteRegistration = "";
  ctx.currentRemoteRegistration = "";
  ctx.channels = ctx.dependencies.targetChannels ?? createRuntimeChannels(ctx);
  ctx.fileTools = createTargetFileTools(() => ctx.fileLease ??= ctx.channels.acquire(ctx.target.id), ctx.cwd);
  ctx.gatewayAgents = resolve(homedir(), ".agents/skills");
  ctx.codemodeOptions = ctx.dependencies.codemodeOptions ?? DEFAULT_CODEMODE_OPTIONS;
  ctx.binDir = resolve(dirname(ctx.dependencies.agentDir), "assets");
  ctx.moduleHome = dirname(ctx.dependencies.agentDir);
  ctx.helpers = await discoverKernelToolCatalog(ctx.moduleHome, ctx.target.id);
  ctx.disposeLibrary = undefined;
  ctx.python = await createPythonClient(ctx);
  ctx.hostedUi = undefined;
  ctx.nativeNames = new Set(createNativeToolDefinitions(ctx.cwd).map((tool) => tool.name));
  ctx.resourceLoaderOptions = resourceDefaults(ctx);
}
